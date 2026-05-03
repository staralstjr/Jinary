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

function create(config: JinaryConfig) {                                                                            
    return {                                                                                                     
        get: async <T>(url: string, decodeFunction: (binary: Uint8Array) => T): Promise<JinaryResponse<T>> => {                                                                  
            const fullURL = config.baseURL + url;
            const controller = new AbortController();
            let timeoutId: number | undefined;
            if (config.timeout) {
                timeoutId = setTimeout(() => controller.abort(), config.timeout);
            }
            const mergedHeaders = {                                                                                
                Accept: 'application/x-protobuf',                                                                  
                ...config.headers,                                                                               
            };
            const response = await fetch(fullURL, {
                headers: mergedHeaders,
                signal: controller.signal,
            });                      
            if(timeoutId) clearTimeout(timeoutId);                                                                               
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
    }                                                                                                            
} 

async function get<T>(
    url: string,
    decodeFunction: (binary: Uint8Array) => T
  ): Promise<JinaryResponse<T>> {                                                                                                          
    const response = await fetch(url, {
        headers: { Accept: 'application/x-protobuf' },
      });

      if (!response.ok) {
        throw new Error(
          `서버 응답 오류: ${response.status} ${response.statusText}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const binaryData = new Uint8Array(arrayBuffer);
      const protobufSize = binaryData.byteLength;

      // 주입받은 디코딩 함수 실행
      const decoded = decodeFunction(binaryData);

      // JSON 크기 비교 로직 (메타데이터용)
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

async function post<T>(
    url: string,
    binary: Uint8Array,
): Promise<JinaryResponse<T>> {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-jinary',
            Accept: 'application/json',
        },
        body: binary as BodyInit,
    });

    if(!response.ok) {
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

export const jinary = { create, get, post };
export type { JinaryMeta, JinaryResponse };