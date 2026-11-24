package mx.rastro.features.predictions.ml;

import org.springframework.stereotype.Component;





@Component
public class ModelFactory {

    public RandomForestClassifier validationForest(long seed) {
        return new RandomForestClassifier(80, 10, 5, seed);
    }

    public RandomForestClassifier productionForest(long seed) {
        return new RandomForestClassifier(180, 12, 4, seed);
    }

    



    public RandomForestClassifier challengerForest(long seed) {
        return new RandomForestClassifier(160, 5, 60, seed);
    }
}
