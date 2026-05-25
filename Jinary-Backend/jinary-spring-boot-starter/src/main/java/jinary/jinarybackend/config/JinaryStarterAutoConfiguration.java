package jinary.jinarybackend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jinary.jinarybackend.jinary.JinaryCodec;
import jinary.jinarybackend.jinary.JinaryHttpMessageConverter;
import jinary.jinarybackend.jinary.JinarySchemaGenerator;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
public class JinaryStarterAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }

    @Bean
    @ConditionalOnMissingBean
    public JinarySchemaGenerator jinarySchemaGenerator() {
        return new JinarySchemaGenerator();
    }

    @Bean
    @ConditionalOnMissingBean
    public JinaryCodec jinaryCodec(JinarySchemaGenerator schemaGenerator, ObjectMapper objectMapper) {
        return new JinaryCodec(schemaGenerator, objectMapper);
    }

    @Bean
    @ConditionalOnMissingBean
    public JinaryHttpMessageConverter jinaryHttpMessageConverter(JinaryCodec codec) {
        return new JinaryHttpMessageConverter(codec);
    }
}
