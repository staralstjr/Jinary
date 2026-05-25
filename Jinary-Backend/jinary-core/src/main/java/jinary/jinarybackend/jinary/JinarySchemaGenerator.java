package jinary.jinarybackend.jinary;

import com.google.protobuf.DescriptorProtos.DescriptorProto;
import com.google.protobuf.DescriptorProtos.FieldDescriptorProto;
import com.google.protobuf.DescriptorProtos.FileDescriptorProto;
import com.google.protobuf.Descriptors.Descriptor;
import com.google.protobuf.Descriptors.DescriptorValidationException;
import com.google.protobuf.Descriptors.FileDescriptor;
import java.lang.reflect.Field;
import java.lang.reflect.GenericArrayType;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.lang.reflect.TypeVariable;
import java.lang.reflect.WildcardType;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class JinarySchemaGenerator {

    private final Map<Class<?>, JinarySchema> cache = new ConcurrentHashMap<>();

    public JinarySchema generate(Class<?> rootType) {
        return cache.computeIfAbsent(rootType, this::buildSchema);
    }

    private JinarySchema buildSchema(Class<?> rootType) {
        SchemaContext context = new SchemaContext();
        buildMessage(rootType, context);
        FileDescriptorProto.Builder fileBuilder = FileDescriptorProto.newBuilder()
                .setName(rootType.getSimpleName() + ".proto")
                .setPackage("jinary.dynamic")
                .setSyntax("proto3");
        context.builtMessages.values().forEach(fileBuilder::addMessageType);
        FileDescriptorProto fileProto = fileBuilder.build();

        try {
            FileDescriptor fileDescriptor = FileDescriptor.buildFrom(fileProto, new FileDescriptor[0]);
            Descriptor descriptor = fileDescriptor.findMessageTypeByName(rootType.getSimpleName());
            return new JinarySchema(fileDescriptor, descriptor);
        } catch (DescriptorValidationException exception) {
            throw new IllegalStateException("Failed to build protobuf schema for " + rootType.getName(), exception);
        }
    }

    private DescriptorProto buildMessage(Class<?> type, SchemaContext context) {
        if (context.builtMessages.containsKey(type)) {
            return context.builtMessages.get(type);
        }
        if (context.inProgress.contains(type)) {
            throw new IllegalStateException("Recursive DTO graphs are not supported for " + type.getName());
        }

        context.inProgress.push(type);

        DescriptorProto.Builder builder = DescriptorProto.newBuilder().setName(type.getSimpleName());
        int fieldNumber = 1;
        for (Field field : getSerializableFields(type)) {
            FieldMetadata metadata = resolveFieldMetadata(field, context);
            FieldDescriptorProto.Builder fieldBuilder = FieldDescriptorProto.newBuilder()
                    .setName(field.getName())
                    .setNumber(fieldNumber++)
                    .setLabel(metadata.repeated()
                            ? FieldDescriptorProto.Label.LABEL_REPEATED
                            : FieldDescriptorProto.Label.LABEL_OPTIONAL);

            if (metadata.messageTypeName() != null) {
                fieldBuilder
                        .setType(FieldDescriptorProto.Type.TYPE_MESSAGE)
                        .setTypeName(metadata.messageTypeName());
            } else {
                fieldBuilder.setType(metadata.scalarType());
            }
            builder.addField(fieldBuilder);
        }

        context.inProgress.pop();

        DescriptorProto message = builder.build();
        context.builtMessages.put(type, message);
        return message;
    }

    private FieldMetadata resolveFieldMetadata(Field field, SchemaContext context) {
        Type resolvedType = field.getGenericType();
        boolean repeated = isCollection(field.getType()) || field.getType().isArray();
        if (repeated) {
            resolvedType = resolveRepeatedElementType(field);
        }

        Class<?> rawType = extractRawClass(resolvedType);
        if (rawType == null) {
            throw new IllegalStateException("Unsupported field type for " + field);
        }

        if (rawType.isEnum()) {
            return new FieldMetadata(FieldDescriptorProto.Type.TYPE_STRING, null, repeated);
        }
        if (isScalar(rawType)) {
            return new FieldMetadata(toScalarType(rawType), null, repeated);
        }

        DescriptorProto nested = buildMessage(rawType, context);
        return new FieldMetadata(null, ".jinary.dynamic." + nested.getName(), repeated);
    }

    private List<Field> getSerializableFields(Class<?> type) {
        List<Field> fields = new ArrayList<>();
        Class<?> current = type;
        while (current != null && current != Object.class) {
            for (Field field : current.getDeclaredFields()) {
                int modifiers = field.getModifiers();
                if (java.lang.reflect.Modifier.isStatic(modifiers) || java.lang.reflect.Modifier.isTransient(modifiers)) {
                    continue;
                }
                field.setAccessible(true);
                fields.add(field);
            }
            current = current.getSuperclass();
        }
        return fields.stream()
                .filter(field -> !field.isSynthetic())
                .toList();
    }

    private boolean isScalar(Class<?> type) {
        return type == String.class
                || type == Integer.class
                || type == int.class
                || type == Long.class
                || type == long.class
                || type == Boolean.class
                || type == boolean.class
                || type == Double.class
                || type == double.class
                || type == Float.class
                || type == float.class
                || type == Short.class
                || type == short.class
                || type == Byte.class
                || type == byte.class
                || type == byte[].class;
    }

    private FieldDescriptorProto.Type toScalarType(Class<?> type) {
        if (type == String.class) {
            return FieldDescriptorProto.Type.TYPE_STRING;
        }
        if (type == Integer.class || type == int.class || type == Short.class || type == short.class || type == Byte.class || type == byte.class) {
            return FieldDescriptorProto.Type.TYPE_INT32;
        }
        if (type == Long.class || type == long.class) {
            return FieldDescriptorProto.Type.TYPE_INT64;
        }
        if (type == Boolean.class || type == boolean.class) {
            return FieldDescriptorProto.Type.TYPE_BOOL;
        }
        if (type == Float.class || type == float.class) {
            return FieldDescriptorProto.Type.TYPE_FLOAT;
        }
        if (type == Double.class || type == double.class) {
            return FieldDescriptorProto.Type.TYPE_DOUBLE;
        }
        if (type == byte[].class) {
            return FieldDescriptorProto.Type.TYPE_BYTES;
        }
        throw new IllegalStateException("Unsupported scalar type: " + type.getName());
    }

    private boolean isCollection(Class<?> type) {
        return Collection.class.isAssignableFrom(type);
    }

    private Type resolveRepeatedElementType(Field field) {
        if (field.getType().isArray()) {
            return field.getType().getComponentType();
        }
        Type genericType = field.getGenericType();
        if (genericType instanceof ParameterizedType parameterizedType) {
            Type[] arguments = parameterizedType.getActualTypeArguments();
            if (arguments.length == 1) {
                return normalizeType(arguments[0]);
            }
        }
        return Object.class;
    }

    private Type normalizeType(Type type) {
        if (type instanceof WildcardType wildcardType) {
            Type[] upperBounds = wildcardType.getUpperBounds();
            return upperBounds.length > 0 ? upperBounds[0] : Object.class;
        }
        if (type instanceof TypeVariable<?>) {
            return Object.class;
        }
        if (type instanceof GenericArrayType genericArrayType) {
            return genericArrayType.getGenericComponentType();
        }
        return type;
    }

    private Class<?> extractRawClass(Type type) {
        Type normalizedType = normalizeType(type);
        if (normalizedType instanceof Class<?> clazz) {
            return clazz;
        }
        if (normalizedType instanceof ParameterizedType parameterizedType) {
            Type rawType = parameterizedType.getRawType();
            if (rawType instanceof Class<?> clazz) {
                return clazz;
            }
        }
        return null;
    }

    private record FieldMetadata(
            FieldDescriptorProto.Type scalarType,
            String messageTypeName,
            boolean repeated
    ) {
    }

    private static final class SchemaContext {
        private final Map<Class<?>, DescriptorProto> builtMessages = new LinkedHashMap<>();
        private final Deque<Class<?>> inProgress = new ArrayDeque<>();
    }
}
