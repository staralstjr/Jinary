package jinary.jinarybackend.jinary;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.protobuf.ByteString;
import com.google.protobuf.Descriptors.Descriptor;
import com.google.protobuf.Descriptors.FieldDescriptor;
import com.google.protobuf.DynamicMessage;
import com.google.protobuf.InvalidProtocolBufferException;
import com.google.protobuf.util.JsonFormat;
import java.lang.reflect.Array;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class JinaryCodec {

    private final JinarySchemaGenerator schemaGenerator;
    private final ObjectMapper objectMapper;

    public JinaryCodec(JinarySchemaGenerator schemaGenerator, ObjectMapper objectMapper) {
        this.schemaGenerator = schemaGenerator;
        this.objectMapper = objectMapper;
    }

    public byte[] encode(Object value) {
        if (value == null) {
            return new byte[0];
        }

        JinarySchema schema = schemaGenerator.generate(value.getClass());
        Map<String, Object> source = objectMapper.convertValue(value, new TypeReference<>() {
        });
        DynamicMessage message = buildMessage(schema.messageDescriptor(), source);
        return message.toByteArray();
    }

    public <T> T decode(byte[] payload, Class<T> targetType) {
        if (payload == null || payload.length == 0) {
            return null;
        }

        JinarySchema schema = schemaGenerator.generate(targetType);
        try {
            DynamicMessage message = DynamicMessage.parseFrom(schema.messageDescriptor(), payload);
            Map<String, Object> data = toMap(message);
            return objectMapper.convertValue(data, targetType);
        } catch (InvalidProtocolBufferException exception) {
            throw new IllegalArgumentException("Invalid protobuf payload for " + targetType.getName(), exception);
        }
    }

    public String toJson(byte[] payload, Class<?> targetType) {
        if (payload == null || payload.length == 0) {
            return "null";
        }

        JinarySchema schema = schemaGenerator.generate(targetType);
        try {
            DynamicMessage message = DynamicMessage.parseFrom(schema.messageDescriptor(), payload);
            return JsonFormat.printer().includingDefaultValueFields().print(message);
        } catch (InvalidProtocolBufferException exception) {
            throw new IllegalArgumentException("Failed to convert protobuf payload to JSON", exception);
        }
    }

    public JsonNode toJsonNode(byte[] payload, Class<?> targetType) {
        try {
            return objectMapper.readTree(toJson(payload, targetType));
        } catch (Exception exception) {
            throw new IllegalArgumentException("Failed to convert protobuf payload to JsonNode", exception);
        }
    }

    private DynamicMessage buildMessage(Descriptor descriptor, Map<String, Object> source) {
        DynamicMessage.Builder builder = DynamicMessage.newBuilder(descriptor);
        for (FieldDescriptor fieldDescriptor : descriptor.getFields()) {
            Object rawValue = source.get(fieldDescriptor.getName());
            if (rawValue == null) {
                continue;
            }

            if (fieldDescriptor.isRepeated()) {
                for (Object element : toIterable(rawValue)) {
                    builder.addRepeatedField(fieldDescriptor, coerceValue(fieldDescriptor, element));
                }
                continue;
            }

            builder.setField(fieldDescriptor, coerceValue(fieldDescriptor, rawValue));
        }
        return builder.build();
    }

    private Iterable<?> toIterable(Object rawValue) {
        if (rawValue instanceof Collection<?> collection) {
            return collection;
        }
        if (rawValue != null && rawValue.getClass().isArray()) {
            int length = Array.getLength(rawValue);
            List<Object> values = new ArrayList<>(length);
            for (int index = 0; index < length; index++) {
                values.add(Array.get(rawValue, index));
            }
            return values;
        }
        throw new IllegalStateException("Expected collection-compatible value, got " + rawValue.getClass().getName());
    }

    @SuppressWarnings("unchecked")
    private Object coerceValue(FieldDescriptor fieldDescriptor, Object rawValue) {
        return switch (fieldDescriptor.getJavaType()) {
            case STRING -> rawValue.toString();
            case INT -> ((Number) rawValue).intValue();
            case LONG -> ((Number) rawValue).longValue();
            case FLOAT -> ((Number) rawValue).floatValue();
            case DOUBLE -> ((Number) rawValue).doubleValue();
            case BOOLEAN -> rawValue;
            case BYTE_STRING -> rawValue instanceof byte[] bytes
                    ? ByteString.copyFrom(bytes)
                    : ByteString.copyFrom(Base64.getDecoder().decode(rawValue.toString()));
            case ENUM -> throw new IllegalStateException("Enum fields are not supported yet");
            case MESSAGE -> buildMessage(fieldDescriptor.getMessageType(), (Map<String, Object>) rawValue);
        };
    }

    private Map<String, Object> toMap(DynamicMessage message) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (FieldDescriptor fieldDescriptor : message.getDescriptorForType().getFields()) {
            if (!message.hasField(fieldDescriptor) && !fieldDescriptor.isRepeated()) {
                continue;
            }

            Object value = message.getField(fieldDescriptor);
            if (fieldDescriptor.isRepeated()) {
                List<Object> values = new ArrayList<>();
                for (Object element : (List<?>) value) {
                    values.add(extractValue(fieldDescriptor, element));
                }
                result.put(fieldDescriptor.getName(), values);
                continue;
            }
            result.put(fieldDescriptor.getName(), extractValue(fieldDescriptor, value));
        }
        return result;
    }

    private Object extractValue(FieldDescriptor fieldDescriptor, Object value) {
        return switch (fieldDescriptor.getJavaType()) {
            case STRING, INT, LONG, FLOAT, DOUBLE, BOOLEAN -> value;
            case BYTE_STRING -> ((ByteString) value).toByteArray();
            case ENUM -> value.toString();
            case MESSAGE -> toMap((DynamicMessage) value);
        };
    }
}
