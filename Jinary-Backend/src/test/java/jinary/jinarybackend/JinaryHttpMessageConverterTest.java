package jinary.jinarybackend;

import jinary.jinarybackend.dto.UserPayload;
import jinary.jinarybackend.jinary.JinaryCodec;
import jinary.jinarybackend.jinary.JinaryMediaTypes;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class JinaryHttpMessageConverterTest {

    @Autowired
    private JinaryCodec jinaryCodec;

    @LocalServerPort
    private int port;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Test
    void returnsBinaryPayloadFromDto() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl("/test/binary")))
                .header("Accept", JinaryMediaTypes.APPLICATION_JINARY)
                .GET()
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("content-type")).hasValue(JinaryMediaTypes.APPLICATION_JINARY);

        UserPayload payload = jinaryCodec.decode(response.body(), UserPayload.class);
        assertThat(payload).isEqualTo(
                new UserPayload(202417051, "Sanghwa", "test@skhu.ac.kr")
        );
    }

    @Test
    void convertsBinaryRequestBodyBackToJsonDto() throws Exception {
        byte[] binary = jinaryCodec.encode(new UserPayload(7, "Ralph", "ralph@example.com"));
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl("/test/json-from-binary")))
                .header("Content-Type", JinaryMediaTypes.APPLICATION_JINARY)
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(binary))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("content-type")).hasValueSatisfying(value ->
                assertThat(value).startsWith("application/json"));
        assertThat(response.body()).contains("\"id\":7");
        assertThat(response.body()).contains("\"name\":\"Ralph\"");
        assertThat(response.body()).contains("\"email\":\"ralph@example.com\"");
    }

    @Test
    void convertsRawBinaryRequestBodyToJsonString() throws Exception {
        byte[] binary = jinaryCodec.encode(new UserPayload(9, "Proto", "proto@example.com"));
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl("/test/json-from-raw-binary")))
                .header("Content-Type", JinaryMediaTypes.APPLICATION_JINARY)
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(binary))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"id\": 9");
        assertThat(response.body()).contains("\"name\": \"Proto\"");
        assertThat(response.body()).contains("\"email\": \"proto@example.com\"");
    }

    private String baseUrl(String path) {
        return "http://localhost:" + port + path;
    }
}
