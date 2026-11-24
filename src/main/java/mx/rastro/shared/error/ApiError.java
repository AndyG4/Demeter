package mx.rastro.shared.error;


public record ApiError(String code, String message, String requestId) {
}
