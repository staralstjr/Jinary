package jinary.jinarybackend.jinary;

import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpOutputMessage;
import org.springframework.http.MediaType;
import org.springframework.http.converter.AbstractHttpMessageConverter;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.converter.HttpMessageNotWritableException;

import java.io.IOException;
import java.util.List;

public class JinaryHttpMessageConverter extends AbstractHttpMessageConverter<Object> {

    private final JinaryCodec codec;

    public JinaryHttpMessageConverter(JinaryCodec codec) {
        super(
                MediaType.parseMediaType(JinaryMediaTypes.APPLICATION_JINARY),
                MediaType.parseMediaType(JinaryMediaTypes.APPLICATION_PROTOBUF)
        );
        this.codec = codec;
    }

    @Override
    protected boolean supports(Class<?> clazz) {
        return !byte[].class.equals(clazz) && !String.class.equals(clazz);
    }

    @Override
    protected Object readInternal(Class<?> clazz, HttpInputMessage inputMessage)
            throws IOException, HttpMessageNotReadableException {
        byte[] payload = inputMessage.getBody().readAllBytes();
        return codec.decode(payload, clazz);
    }

    @Override
    protected void writeInternal(Object object, HttpOutputMessage outputMessage)
            throws IOException, HttpMessageNotWritableException {
        outputMessage.getBody().write(codec.encode(object));
    }

    @Override
    public List<MediaType> getSupportedMediaTypes(Class<?> clazz) {
        return getSupportedMediaTypes();
    }
}
