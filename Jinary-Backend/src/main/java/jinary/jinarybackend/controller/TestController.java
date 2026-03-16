package jinary.jinarybackend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {

    @GetMapping(value = "/test/binary", produces = "application/x-protobuf")
    public byte[] getBinaryData() {
        com.jinary.test.TestUser.UserResponse user = com.jinary.test.TestUser.UserResponse.newBuilder()
                .setId(202417051)
                .setName("Sanghwa")
                .setEmail("test@skhu.ac.kr")
                .build();

        // 바이너리로 변환하여 전송
        return user.toByteArray();
    }
}
