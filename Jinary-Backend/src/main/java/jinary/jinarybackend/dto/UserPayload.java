package jinary.jinarybackend.dto;

public record UserPayload(
        Integer id,
        String name,
        String email
) {
}
