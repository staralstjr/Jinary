package jinary.jinarybackend.controller;

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

@RestController
public class TestController {
    private final JinaryCodec jinaryCodec;

    public TestController(JinaryCodec jinaryCodec) {
        this.jinaryCodec = jinaryCodec;
    }
    //자바객체를 자바객체로 변환하여 반환
    @GetMapping(value = "/test/json", produces = MediaType.APPLICATION_JSON_VALUE)
    public UserPayload getJsonData() {
        return new UserPayload(202417051, "Sanghwa", "test@skhu.ac.kr");
    }

    //자바객체를 BinaryData로 변환하여 반환
    @Jinary
    @GetMapping(value = "/test/binary", produces = JinaryMediaTypes.APPLICATION_JINARY)
    public UserPayload getBinaryData() {
        return new UserPayload(202417051, "Sanghwa", "test@skhu.ac.kr");
    }

    //프론트가 보내는 것은 UserPayload값이 아니라, Jinary 타입의 바이너리 데이터
    //하지만 스프링이 요청을 받을 때, 자동으로 바이너리 데이터를 읽고 UserPayload형태의 자바 객체로 변환
    @Jinary
    @PostMapping(
            value = "/test/json-from-binary",
            consumes = JinaryMediaTypes.APPLICATION_JINARY,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public UserPayload jsonFromBinary(@RequestBody UserPayload request) {
        return request;
    }

    //이것은 @Jinary어노테이션을 사용한 것이 아닌 일반 바이너리 데이터를 받았을 때, 스프링에서 수동으로 자바 객체로 변환
    // 위 /test/josn-from-binary와 비교하여 테스트 용도
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
