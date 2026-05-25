package jinary.jinarybackend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jinary.jinarybackend.jinary.JinaryMediaTypes;
import jinary.jinarybackend.jinary.JinarySchemaGenerator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@Tag(name = "Jinary Schema", description = "Expose protobuf descriptors generated at runtime from backend DTO classes.")
@RestController
public class JinarySchemaController {

    private static final String[] CLASS_NAME_CANDIDATES = {
            "%s",
            "jinary.jinarybackend.dto.%s",
            "jinary.jinarybackend.%s"
    };

    private final JinarySchemaGenerator schemaGenerator;

    public JinarySchemaController(JinarySchemaGenerator schemaGenerator) {
        this.schemaGenerator = schemaGenerator;
    }

    @Operation(
            summary = "Fetch protobuf schema for a DTO type",
            description = "Returns the generated FileDescriptorProto bytes for the requested DTO type. "
                    + "Use the response with protobufjs Root.fromDescriptor() or an equivalent protobuf descriptor loader."
    )
    @ApiResponse(
            responseCode = "200",
            description = "Schema returned as FileDescriptorProto bytes",
            content = @Content(
                    mediaType = JinaryMediaTypes.APPLICATION_PROTOBUF,
                    array = @ArraySchema(schema = @Schema(type = "integer", format = "uint8"))
            )
    )
    @ApiResponse(responseCode = "404", description = "Unknown schema type")
    @GetMapping(value = "/jinary/schema/{typeName:.+}", produces = JinaryMediaTypes.APPLICATION_PROTOBUF)
    public ResponseEntity<byte[]> getSchema(
            @Parameter(
                    description = "DTO simple name or fully-qualified class name. Example: UserPayload or jinary.jinarybackend.dto.UserPayload",
                    example = "UserPayload"
            )
            @PathVariable String typeName
    ) {
        Class<?> targetType = resolveType(typeName);
        byte[] schema = schemaGenerator.generate(targetType)
                .fileDescriptor()
                .toProto()
                .toByteArray();

        return ResponseEntity.ok()
                .header("X-Jinary-Root-Type", targetType.getName())
                .body(schema);
    }

    private Class<?> resolveType(String typeName) {
        for (String candidatePattern : CLASS_NAME_CANDIDATES) {
            String candidate = candidatePattern.formatted(typeName);
            try {
                return Class.forName(candidate);
            } catch (ClassNotFoundException ignored) {
                // Try the next candidate name.
            }
        }

        throw new ResponseStatusException(NOT_FOUND, "Unknown schema type: " + typeName);
    }
}
