import joblib
import numpy as np
from pathlib import Path

def load_data(filename):
    """Load data from file and convert to numpy array."""
    data = []
    ids = []
    with open(filename, 'r') as f:
        for line in f:
            try:
                # Split by '=' to separate ID from data
                id_part, data_part = line.strip().split('=')
                # Extract sample ID
                sample_id = id_part.strip()
                # Parse the numbers after the '='
                numbers = [int(x) for x in data_part.strip().split(',')]
                if len(numbers) == 4:  # Ensure we have 4 numbers
                    data.append(numbers)
                    ids.append(sample_id)
            except (ValueError, IndexError):
                continue
    return np.array(data), ids

def main():
    # Load the trained model
    clf = joblib.load('classifier_model.joblib')
    
    # Load data to classify
    data_to_predict, ids = load_data('lab_data/verify.txt')
    
    # Make predictions
    predictions = clf.predict(data_to_predict)
    
    # Get probabilities for predictions
    probabilities = clf.predict_proba(data_to_predict)
    
    # Create results with IDs and predictions
    for i, (id_num, pred, prob) in enumerate(zip(ids, predictions, probabilities)):
        confidence = max(prob) * 100
        print(f"Sample ID: {id_num}, Predicted: {pred}, Confidence: {confidence:.2f}%")
    
    # Get valid samples (those classified as 'A')
    valid_ids = [ids[i] for i, pred in enumerate(predictions) if pred == 'A']
    
    # Format for submission
    result = ",".join(valid_ids)
    print("\nValid sample IDs (Label A):")
    print(result)

if __name__ == "__main__":
    main()