package jinary.jinarybackend.jinary;

import java.io.IOException;
import java.util.Iterator;
import java.util.stream.BaseStream;
import java.util.stream.Stream;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpOutputMessage;
import org.springframework.http.MediaType;
import org.springframework.http.converter.AbstractHttpMessageConverter;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.converter.HttpMessageNotWritableException;

public class JinaryStreamingHttpMessageConverter extends AbstractHttpMessageConverter<Object> {

    private final JinaryCodec codec;

    public JinaryStreamingHttpMessageConverter(JinaryCodec codec) {
        super(MediaType.parseMediaType(JinaryMediaTypes.APPLICATION_JINARY_STREAM));
        this.codec = codec;
    }

    @Override
    protected boolean supports(Class<?> clazz) {
        return Stream.class.isAssignableFrom(clazz)
                || Iterator.class.isAssignableFrom(clazz)
                || Iterable.class.isAssignableFrom(clazz);
    }

    @Override
    protected boolean canRead(MediaType mediaType) {
        return false;
    }

    @Override
    protected Object readInternal(Class<?> clazz, HttpInputMessage inputMessage)
            throws IOException, HttpMessageNotReadableException {
        throw new HttpMessageNotReadableException("Jinary streaming request bodies are not supported", inputMessage);
    }

    @Override
    protected void writeInternal(Object object, HttpOutputMessage outputMessage)
            throws IOException, HttpMessageNotWritableException {
        Iterator<?> iterator = toIterator(object);
        try {
            while (iterator.hasNext()) {
                codec.writeDelimited(iterator.next(), outputMessage.getBody());
                outputMessage.getBody().flush();
            }
        } finally {
            if (object instanceof BaseStream<?, ?> stream) {
                stream.close();
            }
        }
    }

    private Iterator<?> toIterator(Object object) {
        if (object instanceof Stream<?> stream) {
            return stream.iterator();
        }
        if (object instanceof Iterator<?> iterator) {
            return iterator;
        }
        if (object instanceof Iterable<?> iterable) {
            return iterable.iterator();
        }
        throw new IllegalArgumentException("Unsupported Jinary stream body type: " + object.getClass().getName());
    }
}
