import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from pathlib import Path
import pandas as pd

def load_data(filename):
    """Load data from file and convert to numpy array."""
    data = []
    with open(filename, 'r') as f:
        for line in f:
            # Split the line into numbers
            try:
                numbers = [int(x) for x in line.strip().split(',')]
                if len(numbers) == 4:  # Ensure we have 4 numbers
                    data.append(numbers)
            except ValueError:
                continue
    return np.array(data)

def main():
    # Load the labeled data
    data_dir = Path("lab_data")
    
    # Load A and B datasets
    A_data = load_data(data_dir / "A.txt")
    B_data = load_data(data_dir / "B.txt")
    
    # Create labels
    A_labels = np.full(len(A_data), 'A')
    B_labels = np.full(len(B_data), 'B')
    
    # Combine data and labels
    X = np.vstack((A_data, B_data))
    y = np.concatenate((A_labels, B_labels))
    
    # Split into training and verification sets
    X_train, X_verify, y_train, y_verify = train_test_split(
        X, y,
        test_size=0.1,  # 10% for verification
        random_state=42,
        stratify=y  # Maintain label proportions
    )
    
    # Train Random Forest Classifier
    clf = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        n_jobs=-1  # Use all CPU cores
    )
    
    # Train the model
    clf.fit(X_train, y_train)
    
    # Predict on verification data
    predictions = clf.predict(X_verify)
    
    # Calculate accuracy
    accuracy = np.mean(predictions == y_verify)
    print(f"Verification Accuracy: {accuracy:.2%}")
    
    # Create DataFrame for detailed analysis
    results_df = pd.DataFrame({
        'True_Label': y_verify,
        'Predicted': predictions,
        'Sample': [','.join(map(str, x)) for x in X_verify]
    })
    
    # Print confusion matrix
    print("\nVerification Results:")
    print(pd.crosstab(
        results_df['True_Label'],
        results_df['Predicted'],
        margins=True
    ))
    
    # Save detailed results
    results_df.to_csv('verification_results.csv', index=False)
    
    # Save the model for later use
    import joblib
    joblib.dump(clf, 'classifier_model.joblib')

if __name__ == "__main__":
    main()

# $ python train-ml.py
# Verification Accuracy: 89.58%

# Verification Results:
# Predicted    A   B  All
# True_Label             
# A           29   0   29
# B            5  14   19
# All         34  14   48