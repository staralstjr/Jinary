package jinary.jinarybackend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jinary.jinarybackend.dto.UserPayload;
import jinary.jinarybackend.jinary.Jinary;
import jinary.jinarybackend.jinary.JinaryCodec;
import jinary.jinarybackend.jinary.JinaryMediaTypes;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@Tag(name = "Jinary Demo", description = "Sample endpoints for JSON and Jinary binary payload exchange.")
@RestController
public class TestController {
    private final JinaryCodec jinaryCodec;

    public TestController(JinaryCodec jinaryCodec) {
        this.jinaryCodec = jinaryCodec;
    }

    @Operation(summary = "Return DTO as JSON")
    @GetMapping(value = "/test/json", produces = MediaType.APPLICATION_JSON_VALUE)
    public UserPayload getJsonData() {
        return new UserPayload(202417051, "Sanghwa", "test@skhu.ac.kr");
    }

    // 응답은 자바객체, JSON이 아니라 Jinary컨버터를 통해 바이너리로 직렬화한 값을 반환
    @Jinary
    @Operation(summary = "Return DTO as Jinary binary payload")
    @ApiResponse(
            responseCode = "200",
            description = "Jinary-encoded protobuf binary",
            content = @Content(mediaType = JinaryMediaTypes.APPLICATION_JINARY)
    )
    @GetMapping(value = "/test/binary", produces = JinaryMediaTypes.APPLICATION_JINARY)
    public UserPayload getBinaryData() {
        return new UserPayload(202417051, "Sanghwa", "test@skhu.ac.kr");
    }

    // 파라미터는 바이너리 데이터, 하지만 Jinary를 통해 자동으로 UserPayload라는 자바 객체로 바꿔줌
    // DTO(자바객체)통신으로 보이지만 프론트에서 JSON-바이너리 역직렬화가 구현되어있다면, 바이너리 데이터가 통신하면서 속도 증가
    @Jinary
    @Operation(summary = "Decode Jinary request body and return JSON DTO")
    @PostMapping(
            value = "/test/json-from-binary",
            consumes = JinaryMediaTypes.APPLICATION_JINARY,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public UserPayload jsonFromBinary(@RequestBody UserPayload request) {
        return request;
    }

    @Operation(summary = "Decode raw Jinary binary request body and return JSON string")
    @PostMapping(
            value = "/test/json-from-raw-binary",
            consumes = JinaryMediaTypes.APPLICATION_JINARY,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<byte[]> jsonFromRawBinary(@RequestBody byte[] payload) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(jinaryCodec.toJson(payload, UserPayload.class).getBytes(StandardCharsets.UTF_8));
    }
}
