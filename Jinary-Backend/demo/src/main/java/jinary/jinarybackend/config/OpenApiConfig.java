package jinary.jinarybackend.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI jinaryOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Jinary Backend API")
                .description("Binary/Jinary payload examples and runtime protobuf schema exposure endpoints.")
                .version("v1")
                .contact(new Contact().name("Jinary Backend"))
                .license(new License().name("Internal")));
    }
}
