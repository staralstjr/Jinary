# jinary

> Zero-configuration Protobuf bridge for Spring Boot and React.
> Use plain DTOs in your code while wire traffic is compact Protobuf binary.

`jinary` is the client half of a full-stack library that lets you keep writing
ordinary REST controllers and ordinary frontend code, while replacing JSON on
the wire with Protobuf — without ever hand-writing a `.proto` file. The Spring
Boot side ([Jinary Backend](https://github.com/staralstjr/Jinary)) reflects your
DTOs into Protobuf schemas at runtime; this client fetches that schema,
decodes/encodes binary payloads, and exposes an `axios`-style API plus React
hooks.

## Features

- **Drop-in API** — `jinary.get`, `jinary.post`, `jinary.create({ baseURL })`
- **Streaming** — length-delimited Protobuf over HTTP chunked transfer, exposed
  as an async iterator
- **React hooks** — `useJinary`, `useJinaryMutation`, `useJinaryStream` with
  built-in `AbortController` wiring
- **No `.proto` files** — schema is fetched from the server at runtime and
  cached per type
- **Size metadata** — every response includes both `protobufSize` and
  `jsonSize`, so you can show users the savings

## Installation

```bash
npm install jinary
```

React hooks are optional. If you don't use them, you don't need React installed
— the `./react` entrypoint is the only place React is referenced.

Requires **Node.js 18+** (uses the native `fetch` API).

## Quick start

### Single request

```ts
import { jinary } from 'jinary';

const { data, meta } = await jinary.get<User>(
    'http://localhost:8080/users/1',
    { schema: 'User', baseURL: 'http://localhost:8080' },
);

console.log(data);                    // { id: 1, name: '...', ... }
console.log(meta.protobufSize);       // 42
console.log(meta.jsonSize);           // 68
```

### Instance with shared config

```ts
import { jinary } from 'jinary';

const api = jinary.create({
    baseURL: 'http://localhost:8080',
    timeout: 5000,
    headers: { Authorization: 'Bearer ...' },
});

const { data } = await api.get<User>('/users/1', { schema: 'User' });
await api.post<User>('/users', { name: 'Alice' }, { schema: 'User' });
```

### Streaming

The server responds with length-delimited Protobuf over chunked transfer
encoding. The client yields decoded objects as soon as each chunk arrives.

```ts
import { jinary } from 'jinary';

for await (const user of jinary.stream<User>(
    'http://localhost:8080/users/stream',
    { schema: 'User', baseURL: 'http://localhost:8080' },
)) {
    console.log(user);
}
```

Cancel mid-stream with an `AbortController`:

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 1000);

for await (const user of jinary.stream<User>(url, schemaOpts, {
    signal: controller.signal,
})) {
    // ...
}
```

## React hooks

Import from `jinary/react`:

```tsx
import { useJinary, useJinaryMutation, useJinaryStream } from 'jinary/react';

function UserCard({ id }: { id: number }) {
    const { data, loading, error, meta, fetchData } = useJinary<User>(
        `http://localhost:8080/users/${id}`,
        { schema: 'User', baseURL: 'http://localhost:8080' },
        { autoFetch: true },
    );

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error: {error}</p>;
    if (!data) return null;

    return <p>{data.name} ({meta.protobufSize} bytes)</p>;
}
```

`useJinaryStream` accumulates chunks into an array and auto-cancels on
unmount:

```tsx
function UserList() {
    const { chunks, loading, error, start, stop } = useJinaryStream<User>(
        'http://localhost:8080/users/stream',
        { schema: 'User', baseURL: 'http://localhost:8080' },
    );

    return (
        <>
            <button onClick={start} disabled={loading}>Start</button>
            <button onClick={stop} disabled={!loading}>Stop</button>
            <ul>{chunks.map(u => <li key={u.id}>{u.name}</li>)}</ul>
        </>
    );
}
```

## API

### Core

| Function | Description |
|----------|-------------|
| `jinary.get<T>(url, options, reqOptions?)` | GET, decodes Protobuf body |
| `jinary.post<T>(url, payload, options, reqOptions?)` | POST, encodes payload as Protobuf |
| `jinary.stream<T>(url, options, reqOptions?)` | GET, async iterator over length-delimited messages |
| `jinary.create(config)` | Instance with shared `baseURL`, `timeout`, `headers` |

### Options

```ts
interface JinarySchemaOptions {
    schema: string;       // Java simple class name, e.g. 'User'
    baseURL?: string;     // Required unless using a created instance
}

interface JinaryRequestOptions {
    timeout?: number;     // Milliseconds; ignored if `signal` is provided
    headers?: Record<string, string>;
    signal?: AbortSignal;
}
```

### Response shape

```ts
interface JinaryResponse<T> {
    data: T;
    meta: {
        protobufSize: number;  // bytes on the wire
        jsonSize: number;      // bytes the same object would take as JSON
        rawHex: string;        // first 50 bytes, space-separated hex
    };
}
```

## How it works

1. On first request for a type, the client fetches its Protobuf descriptor
   from `${baseURL}/jinary/schema/{TypeName}`.
2. The descriptor is cached per `(baseURL, typeName)`.
3. Responses (`Accept: application/x-jinary`) are decoded with `protobufjs`.
4. Streaming responses (`Accept: application/x-jinary-stream`) are parsed as
   length-delimited Protobuf: each message is preceded by a varint length
   prefix, and complete messages are yielded as they arrive.

The wire format is documented in
[docs/streaming-protocol.md](https://github.com/staralstjr/Jinary/blob/main/docs/streaming-protocol.md).

## License

MIT © MinseokKwon
