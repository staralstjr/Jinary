import * as protobuf from 'protobufjs';
import {
    FileDescriptorProto,
    FileDescriptorSet,
} from 'protobufjs/ext/descriptor';

interface JinaryMeta {
    protobufSize: number;
    jsonSize: number;
    rawHex: string;
}

interface JinaryResponse<T> {
    data: T;
    meta: JinaryMeta;
}

interface JinaryConfig {
    baseURL: string;
    timeout?: number;
    headers?: Record<string, string>;
}

interface JinarySchemaOptions {
    schema: string;
    baseURL?: string;
}

interface JinaryRequestOptions {
    timeout?: number;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

type DecodeFunction<T> = (binary: Uint8Array) => T;

function buildInit(
    requestOptions?: JinaryRequestOptions,
    config?: JinaryConfig,
): { init: RequestInit; cleanup: () => void } {
    const init: RequestInit = {};

    const mergedHeaders = {
        ...config?.headers,
        ...requestOptions?.headers,
    };
    if (Object.keys(mergedHeaders).length > 0) {
        init.headers = mergedHeaders;
    }

    let cleanup = () => {};

    // 사용자가 직접 signal을 넘기면 그걸 사용. timeout은 무시.
    // 둘 다 없으면 config.timeout fallback. timeout이 있으면 내부 controller 생성.
    if (requestOptions?.signal) {
        init.signal = requestOptions.signal;
    } else {
        const timeout = requestOptions?.timeout ?? config?.timeout;
        if (timeout) {
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                timeout,
            );
            init.signal = controller.signal;
            cleanup = () => clearTimeout(timeoutId);
        }
    }

    return { init, cleanup };
}

const schemaCache = new Map<string, protobuf.Type>();

async function loadSchema(
    baseURL: string,
    typeName: string,
): Promise<protobuf.Type> {
    const cacheKey = `${baseURL}:${typeName}`;
    const cached = schemaCache.get(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${baseURL}/jinary/schema/${typeName}`, {
        headers: { Accept: 'application/x-protobuf' },
    });
    if (!response.ok) {
        throw new Error(
            `스키마 로드 실패: ${response.status} ${response.statusText}`,
        );
    }

    const fileBytes = new Uint8Array(await response.arrayBuffer());

    // 백엔드는 단일 FileDescriptorProto를 보내지만, Root.fromDescriptor는 FileDescriptorSet을 기대하고있습니다.
    const fileDesc = FileDescriptorProto.decode(fileBytes);
    const fileSet = FileDescriptorSet.create({ file: [fileDesc] });
    const root = protobuf.Root.fromDescriptor(fileSet);

    // JinarySchemaGenerator는 package="jinary.dynamic" 고정, 메시지명은 Java simple name이 됩니다.
    const simpleName = typeName.split('.').pop() ?? typeName;
    const messageType = root.lookupType(`jinary.dynamic.${simpleName}`);

    schemaCache.set(cacheKey, messageType);
    return messageType;
}

function resolveBaseURL(
    optionsBaseURL: string | undefined,
    fallback?: string,
): string {
    const baseURL = optionsBaseURL ?? fallback;
    if (!baseURL) {
        throw new Error(
            'baseURL이 지정되지 않았습니다. options.baseURL을 넘기거나 jinary.create({ baseURL })를 사용하세요.',
        );
    }
    return baseURL;
}

async function makeDecoder<T>(
    options: JinarySchemaOptions,
    fallbackBaseURL?: string,
): Promise<DecodeFunction<T>> {
    const baseURL = resolveBaseURL(options.baseURL, fallbackBaseURL);
    const messageType = await loadSchema(baseURL, options.schema);
    return (binary) =>
        messageType.toObject(messageType.decode(binary), {
            longs: Number,
            enums: String,
            defaults: true,
        }) as T;
}

async function makeBinary(
    options: JinarySchemaOptions,
    payload: object,
    fallbackBaseURL?: string,
): Promise<Uint8Array> {
    const baseURL = resolveBaseURL(options.baseURL, fallbackBaseURL);
    const messageType = await loadSchema(baseURL, options.schema);
    const message = messageType.create(payload);
    return messageType.encode(message).finish();
}

async function performGet<T>(
    fullURL: string,
    decodeFunction: DecodeFunction<T>,
    init?: RequestInit,
): Promise<JinaryResponse<T>> {
    const headers = {
        Accept: 'application/x-jinary',
        ...(init?.headers as Record<string, string> | undefined),
    };
    const response = await fetch(fullURL, { ...init, headers });
    if (!response.ok) {
        throw new Error(
            `서버 응답 오류: ${response.status} ${response.statusText}`,
        );
    }
    const arrayBuffer = await response.arrayBuffer();
    const binaryData = new Uint8Array(arrayBuffer);
    const protobufSize = binaryData.byteLength;
    const decoded = decodeFunction(binaryData);
    const jsonSize = new TextEncoder().encode(
        JSON.stringify(decoded),
    ).byteLength;
    return {
        data: decoded,
        meta: {
            protobufSize,
            jsonSize,
            rawHex: Array.from(binaryData.slice(0, 50))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join(' '),
        },
    };
}

async function performPost<T>(
    fullURL: string,
    binary: Uint8Array,
    init?: RequestInit,
): Promise<JinaryResponse<T>> {
    const headers = {
        'Content-Type': 'application/x-jinary',
        Accept: 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
    };
    const response = await fetch(fullURL, {
        ...init,
        method: 'POST',
        headers,
        body: binary as BodyInit,
    });
    if (!response.ok) {
        throw new Error(
            `서버 응답 오류: ${response.status} ${response.statusText}`,
        );
    }
    const json = (await response.json()) as T;
    const protobufSize = binary.byteLength;
    const jsonSize = new TextEncoder().encode(JSON.stringify(json)).byteLength;
    return {
        data: json,
        meta: {
            protobufSize,
            jsonSize,
            rawHex: Array.from(binary.slice(0, 50))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join(' '),
        },
    };
}

async function get<T>(
    url: string,
    decodeFunction: DecodeFunction<T>,
    requestOptions?: JinaryRequestOptions,
): Promise<JinaryResponse<T>>;
async function get<T>(
    url: string,
    options: JinarySchemaOptions,
    requestOptions?: JinaryRequestOptions,
): Promise<JinaryResponse<T>>;
async function get<T>(
    url: string,
    arg: DecodeFunction<T> | JinarySchemaOptions,
    requestOptions?: JinaryRequestOptions,
): Promise<JinaryResponse<T>> {
    const decodeFunction =
        typeof arg === 'function' ? arg : await makeDecoder<T>(arg);
    const { init, cleanup } = buildInit(requestOptions);
    try {
        return await performGet<T>(url, decodeFunction, init);
    } finally {
        cleanup();
    }
}

async function post<T>(
    url: string,
    binary: Uint8Array,
    requestOptions?: JinaryRequestOptions,
): Promise<JinaryResponse<T>>;
async function post<T>(
    url: string,
    payload: object,
    options: JinarySchemaOptions,
    requestOptions?: JinaryRequestOptions,
): Promise<JinaryResponse<T>>;
async function post<T>(
    url: string,
    payloadOrBinary: Uint8Array | object,
    optionsOrRequestOptions?: JinarySchemaOptions | JinaryRequestOptions,
    requestOptions?: JinaryRequestOptions,
): Promise<JinaryResponse<T>> {
    const isSchemaOptions =
        optionsOrRequestOptions !== undefined &&
        'schema' in optionsOrRequestOptions;
    const schemaOptions = isSchemaOptions
        ? (optionsOrRequestOptions as JinarySchemaOptions)
        : undefined;
    const reqOptions = isSchemaOptions
        ? requestOptions
        : (optionsOrRequestOptions as JinaryRequestOptions | undefined);

    const binary = schemaOptions
        ? await makeBinary(schemaOptions, payloadOrBinary as object)
        : (payloadOrBinary as Uint8Array);
    const { init, cleanup } = buildInit(reqOptions);
    try {
        return await performPost<T>(url, binary, init);
    } finally {
        cleanup();
    }
}

function create(config: JinaryConfig) {
    async function instanceGet<T>(
        url: string,
        arg: DecodeFunction<T> | JinarySchemaOptions,
        requestOptions?: JinaryRequestOptions,
    ): Promise<JinaryResponse<T>> {
        const fullURL = config.baseURL + url;
        const decodeFunction =
            typeof arg === 'function'
                ? arg
                : await makeDecoder<T>(arg, config.baseURL);
        const { init, cleanup } = buildInit(requestOptions, config);
        try {
            return await performGet<T>(fullURL, decodeFunction, init);
        } finally {
            cleanup();
        }
    }

    async function instancePost<T>(
        url: string,
        payloadOrBinary: Uint8Array | object,
        options?: JinarySchemaOptions,
        requestOptions?: JinaryRequestOptions,
    ): Promise<JinaryResponse<T>> {
        const fullURL = config.baseURL + url;
        const binary = options
            ? await makeBinary(
                  options,
                  payloadOrBinary as object,
                  config.baseURL,
              )
            : (payloadOrBinary as Uint8Array);
        const { init, cleanup } = buildInit(requestOptions, config);
        try {
            return await performPost<T>(fullURL, binary, init);
        } finally {
            cleanup();
        }
    }

    return {
        get: instanceGet,
        post: instancePost,
    };
}

export const jinary = { create, get, post, loadSchema };
export type {
    JinaryMeta,
    JinaryResponse,
    JinaryConfig,
    JinarySchemaOptions,
    JinaryRequestOptions,
};
