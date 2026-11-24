package mx.rastro.features.records;

import mx.rastro.features.catalog.Catalog;
import mx.rastro.features.catalog.Municipality;
import mx.rastro.features.catalog.State;
import mx.rastro.shared.text.TextNormalizer;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;








@Component
public class DemoRecordsFactory {

    private static final int TOTAL = 14_000;
    private static final long SEED = 20261118L;

    private static final String[] FEMENINO = {
            "María", "Ana", "Guadalupe", "Fernanda", "Sofía", "Valeria", "Camila", "Ximena",
            "Regina", "Renata", "Daniela", "Gabriela", "Alejandra", "Paola", "Mónica", "Leticia",
            "Rosa", "Elena", "Lucía", "Isabel", "Adriana", "Claudia", "Verónica", "Silvia",
            "Norma", "Patricia", "Yolanda", "Martha", "Araceli", "Concepción", "Josefina", "Beatriz",
            "Carolina", "Diana", "Estefanía", "Fátima", "Irene", "Jazmín", "Karla", "Liliana",
            "Marisol", "Nayeli", "Olga", "Perla", "Rocío", "Sandra", "Teresa", "Ursula",
            "Violeta", "Wendy", "Yuridia", "Zulema", "Itzel", "Citlali", "Xóchitl", "América"
    };

    private static final String[] MASCULINO = {
            "José", "Juan", "Luis", "Carlos", "Miguel", "Jorge", "Francisco", "Pedro",
            "Ricardo", "Alejandro", "Fernando", "Roberto", "Eduardo", "Javier", "Manuel", "Daniel",
            "Arturo", "Raúl", "Enrique", "Óscar", "Héctor", "Gerardo", "Alberto", "Sergio",
            "Andrés", "Emiliano", "Diego", "Jesús", "Antonio", "Ramón", "Salvador", "Rubén",
            "Mauricio", "Iván", "Óliver", "Pablo", "Rodrigo", "Santiago", "Tomás", "Víctor",
            "Adán", "Benjamín", "César", "Damián", "Ernesto", "Felipe", "Gustavo", "Hugo",
            "Ignacio", "Julio", "Leonardo", "Martín", "Nicolás", "Octavio", "Rafael", "Sebastián"
    };

    private static final String[] APELLIDOS = {
            "Hernández", "García", "Martínez", "López", "González", "Pérez", "Rodríguez", "Sánchez",
            "Ramírez", "Cruz", "Flores", "Gómez", "Morales", "Vázquez", "Reyes", "Jiménez",
            "Torres", "Díaz", "Gutiérrez", "Mendoza", "Ruiz", "Aguilar", "Ortiz", "Moreno",
            "Castillo", "Romero", "Álvarez", "Chávez", "Rivera", "Juárez", "Domínguez", "Herrera",
            "Medina", "Castro", "Vargas", "Rojas", "Ortiz", "Silva", "Núñez", "Luna",
            "Contreras", "Salazar", "Ibarra", "Cervantes", "Guerrero", "Delgado", "Ríos", "Campos",
            "Trejo", "Espinoza", "Aguirre", "Bautista", "Carrillo", "Cortés", "Escobar", "Fuentes",
            "Galván", "Lara", "León", "Márquez", "Mejía", "Miranda", "Nava", "Orozco",
            "Padilla", "Palacios", "Pineda", "Quintero", "Robles", "Rosas", "Santiago", "Soto",
            "Tapia", "Valdez", "Velázquez", "Villanueva", "Zamora", "Zúñiga", "Barrera", "Bermúdez"
    };

    
    private static final Map<String, Double> FACTOR_ESTADO = Map.ofEntries(
            Map.entry("09", 1.35), Map.entry("15", 1.55), Map.entry("14", 1.45),
            Map.entry("19", 1.30), Map.entry("28", 1.45), Map.entry("12", 1.50),
            Map.entry("30", 1.35), Map.entry("07", 1.25), Map.entry("26", 1.30),
            Map.entry("25", 1.40), Map.entry("16", 1.35), Map.entry("21", 1.15),
            Map.entry("18", 1.20), Map.entry("20", 1.10));

    public LoadedRecords generate(Catalog catalog) {
        SplittableRandom random = new SplittableRandom(SEED);
        List<State> states = new ArrayList<>(catalog.states().values());
        double[] stateCumulative = new double[states.size()];
        double totalWeight = 0;
        for (int i = 0; i < states.size(); i++) {
            State state = states.get(i);
            double weight = Math.max(1, state.poblacion()) * FACTOR_ESTADO.getOrDefault(state.id(), 1.0);
            totalWeight += weight;
            stateCumulative[i] = totalWeight;
        }

        Map<String, double[]> municipalityCumulative = new HashMap<>();
        Map<String, List<Municipality>> municipalitiesByState = new HashMap<>();
        for (State state : states) {
            List<Municipality> list = catalog.municipalitiesOf(state.id());
            municipalitiesByState.put(state.id(), list);
            double[] cumulative = new double[list.size()];
            double total = 0;
            for (int i = 0; i < list.size(); i++) {
                total += Math.max(1_000, list.get(i).poblacion());
                cumulative[i] = total;
            }
            municipalityCumulative.put(state.id(), cumulative);
        }

        List<PersonRecord> records = new ArrayList<>(TOTAL);
        for (int i = 0; i < TOTAL; i++) {
            State state = states.get(pick(stateCumulative, totalWeight, random));
            List<Municipality> municipalities = municipalitiesByState.get(state.id());
            double[] cumulative = municipalityCumulative.get(state.id());
            Municipality municipality = municipalities.get(pick(cumulative, cumulative[cumulative.length - 1], random));

            String sexo = random.nextInt(100) < 49 ? "Mujer" : random.nextInt(100) < 97 ? "Hombre" : "No especificado";
            String nombre = buildName(sexo, random);
            LocalDate visto = randomDate(random);
            RecordStatus status = random.nextInt(100) < 63
                    ? (random.nextInt(100) < 76 ? RecordStatus.DESAPARECIDA : RecordStatus.NO_LOCALIZADA)
                    : RecordStatus.LOCALIZADA;
            String condicion = status == RecordStatus.LOCALIZADA ? condition(random) : null;
            Integer edad = random.nextInt(100) < 9 ? null : 4 + random.nextInt(83);

            records.add(new PersonRecord(
                    "D" + String.format("%06d", i + 1),
                    "DEMO-" + visto.getYear() + "-" + String.format("%06d", i + 1),
                    nombre,
                    TextNormalizer.normalize(nombre),
                    edad,
                    sexo,
                    visto,
                    municipality.id(),
                    state.id(),
                    status,
                    condicion,
                    "Demostración sintética · Rastro",
                    "Generador local",
                    true,
                    false,
                    null,
                    null,
                    LocalDate.of(2026, 11, 18)));
        }
        return new LoadedRecords(List.copyOf(records), "Demostración sintética", true, LocalDate.of(2026, 11, 18));
    }

    private String buildName(String sexo, SplittableRandom random) {
        String[] pool = "Mujer".equals(sexo) ? FEMENINO : MASCULINO;
        StringBuilder name = new StringBuilder(pool[random.nextInt(pool.length)]);
        if (random.nextInt(100) < 38) {
            name.append(' ').append(pool[random.nextInt(pool.length)]);
        }
        name.append(' ').append(APELLIDOS[random.nextInt(APELLIDOS.length)]);
        name.append(' ').append(APELLIDOS[random.nextInt(APELLIDOS.length)]);
        return name.toString();
    }

    private LocalDate randomDate(SplittableRandom random) {
        int[] weights = {8, 8, 10, 12, 14, 16, 16, 16};
        int pick = random.nextInt(100);
        int year = 2019;
        int acc = 0;
        for (int i = 0; i < weights.length; i++) {
            acc += weights[i];
            if (pick < acc) {
                year = 2019 + i;
                break;
            }
        }
        int maxDay = year == 2026 ? 300 : (year % 4 == 0 ? 366 : 365);
        return LocalDate.ofYearDay(year, 1 + random.nextInt(maxDay));
    }

    private String condition(SplittableRandom random) {
        int value = random.nextInt(100);
        if (value < 68) {
            return "Localizada con vida";
        }
        if (value < 95) {
            return "Localizada sin vida";
        }
        return "Sin información sobre la condición";
    }

    private int pick(double[] cumulative, double total, SplittableRandom random) {
        double target = random.nextDouble() * total;
        int low = 0;
        int high = cumulative.length - 1;
        while (low < high) {
            int mid = (low + high) >>> 1;
            if (cumulative[mid] < target) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        return low;
    }
}
