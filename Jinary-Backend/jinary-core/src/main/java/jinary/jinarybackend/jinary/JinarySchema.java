package jinary.jinarybackend.jinary;

import com.google.protobuf.Descriptors.Descriptor;
import com.google.protobuf.Descriptors.FileDescriptor;

public record JinarySchema(
        FileDescriptor fileDescriptor,
        Descriptor messageDescriptor
) {
}
