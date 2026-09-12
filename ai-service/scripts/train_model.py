import pandas as pd
from sklearn.model_selection import GroupShuffleSplit
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib
import os
import matplotlib.pyplot as plt
import seaborn as sns

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_CSV = os.path.join(BASE_DIR, "data", "dataset.csv")
MODEL_SAVE_PATH = os.path.join(BASE_DIR, "app", "models", "exercise_classifier.pkl")

def train_model():
    import logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    logger = logging.getLogger(__name__)

    if not os.path.exists(DATASET_CSV):
        logger.error(f"Dataset not found at {DATASET_CSV}")
        return

    logger.info("Loading dataset into memory...")
    df = pd.read_csv(DATASET_CSV)
    
    if df.empty:
        logger.warning("Dataset is empty. Aborting training.")
        return

    X = df.drop(['class', 'video_id'], axis=1)
    y = df['class']
    groups = df['video_id']

    logger.info(f"Dataset loaded. Total samples: {len(df)} | Unique videos: {groups.nunique()}")

    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(gss.split(X, y, groups))
    
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    logger.info("Initializing and fitting RandomForestClassifier...")
    rf_model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    rf_model.fit(X_train, y_train)

    y_pred = rf_model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    logger.info(f"Validation Accuracy: {accuracy * 100:.2f}%")

    os.makedirs(os.path.dirname(MODEL_SAVE_PATH), exist_ok=True)
    joblib.dump(rf_model, MODEL_SAVE_PATH)
    logger.info(f"Model successfully saved to: {MODEL_SAVE_PATH}")
    
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=rf_model.classes_, yticklabels=rf_model.classes_)
    plt.title('Confusion Matrix')
    plt.ylabel('True Class')
    plt.xlabel('Predicted Class')
    plt.tight_layout()
    
    plot_path = os.path.join(BASE_DIR, 'data', 'confusion_matrix.png')
    plt.savefig(plot_path)
    logger.info(f"Confusion matrix exported to: {plot_path}")

if __name__ == "__main__":
    train_model()
