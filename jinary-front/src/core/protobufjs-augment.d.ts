// protobufjs/ext/descriptor가 런타임에 Root.fromDescriptor를 추가하지만 main 타입에 빠져있어 보강.
import 'protobufjs';

declare module 'protobufjs' {
    namespace Root {
        function fromDescriptor(
            descriptor: import('protobufjs').Message<{}> | object,
        ): import('protobufjs').Root;
    }
}
