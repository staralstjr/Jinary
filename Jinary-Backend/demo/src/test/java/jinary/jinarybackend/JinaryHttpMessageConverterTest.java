package jinary.jinarybackend;

import com.google.protobuf.DescriptorProtos.FileDescriptorProto;
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

    private static final UserPayload DEFAULT_USER =
            new UserPayload(202417051, "Sanghwa", "test@skhu.ac.kr");

    @Autowired
    private JinaryCodec jinaryCodec;

    @LocalServerPort
    private int port;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Test
    void returnsJsonPayloadFromDto() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl("/test/json")))
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("content-type")).hasValueSatisfying(value ->
                assertThat(value).startsWith("application/json"));
        assertThat(response.body()).contains("\"id\":202417051");
        assertThat(response.body()).contains("\"name\":\"Sanghwa\"");
        assertThat(response.body()).contains("\"email\":\"test@skhu.ac.kr\"");
    }

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
        assertThat(payload).isEqualTo(DEFAULT_USER);
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

    @Test
    void returnsProtobufSchemaForRequestedType() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl("/jinary/schema/UserPayload")))
                .header("Accept", JinaryMediaTypes.APPLICATION_PROTOBUF)
                .GET()
                .build();

        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("content-type")).hasValue(JinaryMediaTypes.APPLICATION_PROTOBUF);
        assertThat(response.headers().firstValue("x-jinary-root-type"))
                .hasValue("jinary.jinarybackend.dto.UserPayload");

        FileDescriptorProto schema = FileDescriptorProto.parseFrom(response.body());
        assertThat(schema.getName()).isEqualTo("UserPayload.proto");
        assertThat(schema.getMessageTypeList()).anySatisfy(message ->
                assertThat(message.getName()).isEqualTo("UserPayload"));
    }

    @Test
    void returnsNotFoundForUnknownSchemaType() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl("/jinary/schema/UnknownPayload")))
                .header("Accept", JinaryMediaTypes.APPLICATION_PROTOBUF)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(404);
    }

    @Test
    void exposesSwaggerUi() throws Exception {
        HttpRequest redirectRequest = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl("/swagger-ui.html")))
                .GET()
                .build();

        HttpResponse<String> redirectResponse = httpClient.send(redirectRequest, HttpResponse.BodyHandlers.ofString());

        assertThat(redirectResponse.statusCode()).isEqualTo(302);
        assertThat(redirectResponse.headers().firstValue("location")).hasValue("/swagger-ui/index.html");

        HttpRequest indexRequest = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl("/swagger-ui/index.html")))
                .GET()
                .build();

        HttpResponse<String> indexResponse = httpClient.send(indexRequest, HttpResponse.BodyHandlers.ofString());

        assertThat(indexResponse.statusCode()).isEqualTo(200);
        assertThat(indexResponse.body()).contains("Swagger UI");
    }

    @Test
    void exposesOpenApiDocsIncludingSchemaEndpoint() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl("/v3/api-docs")))
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("content-type")).hasValueSatisfying(value ->
                assertThat(value).startsWith("application/json"));
        assertThat(response.body()).contains("\"title\":\"Jinary Backend API\"");
        assertThat(response.body()).contains("/jinary/schema/{typeName}");
        assertThat(response.body()).contains("/test/binary");
    }

    private String baseUrl(String path) {
        return "http://localhost:" + port + path;
    }
}
