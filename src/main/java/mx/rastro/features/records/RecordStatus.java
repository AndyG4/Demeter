package mx.rastro.features.records;

import mx.rastro.shared.text.TextNormalizer;

public enum RecordStatus {
    DESAPARECIDA("Desaparecida"),
    NO_LOCALIZADA("No localizada"),
    LOCALIZADA("Localizada"),
    CONFIDENCIAL("Confidencial");

    private final String label;

    RecordStatus(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public boolean isMissing() {
        return this != LOCALIZADA;
    }

    public static RecordStatus from(String value) {
        String normalized = TextNormalizer.normalize(value);
        if (normalized.isEmpty()) {
            return DESAPARECIDA;
        }
        if (normalized.startsWith("localizada") || normalized.startsWith("localizado")
                || normalized.startsWith("encontrada") || normalized.startsWith("encontrado")
                || normalized.equals("localizacion")) {
            return LOCALIZADA;
        }
        if (normalized.startsWith("no localizada") || normalized.startsWith("no localizado")
                || normalized.startsWith("sin localizar") || normalized.startsWith("no-localizada")) {
            return NO_LOCALIZADA;
        }
        if (normalized.startsWith("confidencial")) {
            return CONFIDENCIAL;
        }
        return DESAPARECIDA;
    }
}
