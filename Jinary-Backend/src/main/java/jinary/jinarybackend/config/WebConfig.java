package jinary.jinarybackend.config;

import jinary.jinarybackend.jinary.JinaryHttpMessageConverter;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final JinaryHttpMessageConverter jinaryHttpMessageConverter;

    public WebConfig(JinaryHttpMessageConverter jinaryHttpMessageConverter) {
        this.jinaryHttpMessageConverter = jinaryHttpMessageConverter;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("*")
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*");
    }

    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
        converters.add(0, jinaryHttpMessageConverter);
    }
}
