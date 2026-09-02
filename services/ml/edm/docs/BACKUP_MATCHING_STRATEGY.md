# Enhanced Backup Matching Strategy for Modern Songs

## Problem Statement

The current system has 4 modern indie/alternative songs (2020-2023) that are unlikely to match the older LMD dataset:
- "Call Your Mom" by Noah Kahan
- "Not Strong Enough" by boygenius
- "Savior Complex" by Phoebe Bridgers
- "Superposition" by Daniel Caesar

The existing fallback mechanism (`genre_fallback_midis` function) provides **random** MIDI files, which doesn't maintain musical coherence or the "learned style" concept.

## Current System Analysis

### Existing Components

1. **Matching Confidence System** (lines 93-139)
   - `calculate_match_confidence()`: Weighted scoring (40% artist, 60% song)
   - Three confidence thresholds:
     - `MIN_CONFIDENCE_EXACT = 0.95` (exact matches)
     - `MIN_CONFIDENCE_FUZZY = 0.80` (fuzzy matches)
     - `MIN_CONFIDENCE_WEAK = 0.60` (acceptable fallback)

2. **String Normalization** (lines 50-74)
   - Removes parentheses/brackets (remixes, versions)
   - Removes special characters
   - Removes common articles (the, a, an)
   - Normalizes whitespace

3. **Similarity Scoring** (lines 76-91)
   - Uses `SequenceMatcher` for fuzzy string matching
   - Returns 0-1 similarity ratio

4. **Genre Fallback** (lines 488-617)
   - Completely random MIDI selection
   - Hash-based sampling for reproducibility
   - No musical characteristics considered

### Key Limitations

1. **No Musical Feature Matching**: Current fallback ignores tempo, pitch range, note density, etc.
2. **No Artist/Genre Keywords**: Doesn't use artist name hints like "folk", "indie", "acoustic"
3. **No Filename Pattern Analysis**: Ignores potentially useful metadata in MIDI filenames
4. **Random = Incoherent**: Random fallback breaks the "learned style" concept

## Enhanced Matching Strategy

### Design Philosophy

**Multi-Layer Intelligent Fallback**: When exact/fuzzy matches fail, progressively use musical characteristics, keyword matching, and MIDI metadata to find stylistically similar MIDIs.

### Strategy Layers

```
Layer 1: Exact/Fuzzy Match (EXISTING)
    ↓ (if no match)
Layer 2: Artist Keyword Match (NEW)
    ↓ (if no match)
Layer 3: Musical Feature Match (NEW)
    ↓ (if no match)
Layer 4: Filename Pattern Match (NEW)
    ↓ (if still no match)
Layer 5: Diverse Random Fallback (EXISTING, but improved)
```

### Layer 2: Artist Keyword Matching

**Concept**: Extract genre/style keywords from artist names and match against MIDI filenames.

**Implementation**:
```python
# Artist → Keywords mapping
ARTIST_KEYWORDS = {
    'noah kahan': ['folk', 'acoustic', 'indie', 'singer', 'songwriter', 'country'],
    'boygenius': ['indie', 'rock', 'alternative', 'folk', 'acoustic'],
    'phoebe bridgers': ['indie', 'folk', 'acoustic', 'singer', 'songwriter', 'alternative'],
    'daniel caesar': ['soul', 'r&b', 'rnb', 'neo soul', 'jazz', 'smooth'],
}

# Genre → Style characteristics
GENRE_STYLE_KEYWORDS = {
    'folk': ['acoustic', 'guitar', 'ballad', 'simple', 'vocal'],
    'indie': ['alternative', 'rock', 'pop', 'guitar', 'modern'],
    'soul': ['jazz', 'piano', 'smooth', 'vocal', 'blues'],
    'r&b': ['soul', 'smooth', 'groove', 'piano', 'vocal'],
}
```

**Matching Process**:
1. Extract keywords for unmatched artist
2. Search MIDI filenames for keyword matches
3. Score matches based on keyword frequency and position
4. Select top N MIDIs with highest keyword scores

### Layer 3: Musical Feature Matching

**Concept**: Use MIDI feature extraction to find files with similar musical characteristics.

**Available Features** (from `midi_features.py`):
- Tempo (avg_tempo, tempo_changes)
- Pitch (avg_pitch, pitch_range, pitch_std)
- Rhythm (note_density, avg_note_duration)
- Dynamics (avg_velocity, velocity_std)
- Instrumentation (num_instruments, is_drum)

**Genre → Feature Profile**:
```python
GENRE_PROFILES = {
    'indie_folk': {
        'tempo_range': (80, 130),      # Moderate tempo
        'pitch_range': (30, 70),        # Moderate range
        'note_density': (2, 8),         # Not too sparse, not too dense
        'avg_velocity': (60, 90),       # Moderate dynamics
        'num_instruments': (1, 4),      # Small ensemble
        'is_drum': False,               # Often acoustic
    },
    'soul_rnb': {
        'tempo_range': (70, 110),       # Slow to moderate
        'pitch_range': (40, 80),        # Wide vocal range
        'note_density': (3, 10),        # Moderate to dense
        'avg_velocity': (70, 100),      # Expressive dynamics
        'num_instruments': (2, 6),      # Medium ensemble
        'is_drum': True,                # Usually has drums
    },
}
```

**Matching Process**:
1. Define expected feature profile for artist/genre
2. Extract features from candidate MIDIs (sample of dataset)
3. Calculate feature distance using weighted Euclidean distance
4. Select MIDIs with smallest feature distance

### Layer 4: Filename Pattern Matching

**Concept**: Parse MIDI filenames for genre/style hints.

**Common Patterns in MIDI Files**:
- `Artist - Song (acoustic).mid`
- `Song_indie_version.mid`
- `Folk_Collection_01.mid`
- `Jazz_Piano_Ballad.mid`

**Implementation**:
```python
def extract_filename_keywords(filename: str) -> List[str]:
    """Extract potential genre/style keywords from filename"""
    keywords = []

    # Common genre markers
    genre_markers = ['folk', 'indie', 'rock', 'jazz', 'soul', 'rnb',
                     'acoustic', 'piano', 'guitar', 'ballad', 'pop']

    filename_lower = filename.lower()
    for marker in genre_markers:
        if marker in filename_lower:
            keywords.append(marker)

    return keywords
```

### Layer 5: Improved Random Fallback

**Enhancement**: Instead of completely random, use stratified sampling.

**Concept**:
- Sample from diverse parts of the dataset
- Ensure variety in tempo, pitch, instrumentation
- Avoid clusters (don't pick all MIDIs from same artist/style)

## Implementation Plan

### New Functions to Add

1. **`build_keyword_index()`**
   - Index all MIDI filenames by keywords
   - Create reverse mapping: keyword → MIDI files
   - Run during initial indexing phase

2. **`match_by_keywords()`**
   - Match unmatched tracks using artist/genre keywords
   - Score based on keyword relevance
   - Return top N matches with confidence scores

3. **`build_feature_cache()`**
   - Extract features from sample of MIDI files (~1000-5000)
   - Cache features for fast lookup
   - Index by feature vectors for similarity search

4. **`match_by_features()`**
   - Define expected feature profile for track
   - Find MIDIs with similar features
   - Return top N matches with feature similarity scores

5. **`match_by_filename_patterns()`**
   - Extract keywords from MIDI filenames
   - Match against artist/genre expectations
   - Return scored matches

6. **`enhanced_fallback_pipeline()`**
   - Orchestrate all fallback layers
   - Try each layer sequentially
   - Maintain confidence scores throughout

### Configuration Parameters

**User-Adjustable Settings**:

```python
class FallbackConfig:
    """Configuration for enhanced fallback matching"""

    # Layer 2: Keyword Matching
    enable_keyword_matching: bool = True
    keyword_match_threshold: float = 0.3      # Min keyword score
    keywords_per_track: int = 5                # Top N keyword matches

    # Layer 3: Feature Matching
    enable_feature_matching: bool = True
    feature_sample_size: int = 2000            # MIDIs to extract features from
    feature_match_threshold: float = 0.7       # Min feature similarity
    features_per_track: int = 5                # Top N feature matches
    feature_weights: Dict[str, float] = {
        'tempo': 0.25,
        'pitch': 0.20,
        'rhythm': 0.20,
        'dynamics': 0.15,
        'instrumentation': 0.20,
    }

    # Layer 4: Filename Pattern Matching
    enable_pattern_matching: bool = True
    pattern_match_threshold: float = 0.2       # Min pattern score
    patterns_per_track: int = 3                # Top N pattern matches

    # Layer 5: Random Fallback
    random_fallback_diversity: float = 0.8     # Stratification level
    max_midis_per_track: int = 10              # Final MIDI count

    # Global Settings
    min_overall_confidence: float = 0.4        # Accept fallback if >= this
    prefer_higher_layers: bool = True          # Weight earlier layers higher
    combine_results: bool = True               # Merge results from layers
```

### Confidence Scoring System

**Multi-Layer Confidence**:

```python
def calculate_fallback_confidence(
    layer: str,
    layer_score: float,
    metadata: Dict
) -> float:
    """
    Calculate confidence for fallback matches

    Layer weights:
    - keyword_match: 0.7-0.85
    - feature_match: 0.6-0.8
    - pattern_match: 0.5-0.7
    - random_fallback: 0.3-0.5
    """
    layer_weights = {
        'keyword': (0.70, 0.85),
        'feature': (0.60, 0.80),
        'pattern': (0.50, 0.70),
        'random': (0.30, 0.50),
    }

    min_conf, max_conf = layer_weights[layer]

    # Scale layer score to confidence range
    confidence = min_conf + (layer_score * (max_conf - min_conf))

    return confidence
```

### Expected Match Results

**For the 4 Modern Songs**:

1. **Noah Kahan - "Call Your Mom"**
   - Layer 2 (Keywords): Match MIDIs with "folk", "acoustic", "indie"
   - Layer 3 (Features): Find moderate tempo (90-120 BPM), simple instrumentation
   - Expected: 6-8 indie/folk MIDIs with ~0.65-0.75 confidence

2. **boygenius - "Not Strong Enough"**
   - Layer 2 (Keywords): Match "indie", "rock", "alternative"
   - Layer 3 (Features): Moderate tempo, guitar-based, 2-4 instruments
   - Expected: 6-8 indie/alt-rock MIDIs with ~0.70-0.80 confidence

3. **Phoebe Bridgers - "Savior Complex"**
   - Layer 2 (Keywords): Match "indie", "folk", "singer-songwriter"
   - Layer 3 (Features): Slow tempo (70-90 BPM), piano/guitar, sparse
   - Expected: 5-7 indie/folk ballads with ~0.65-0.75 confidence

4. **Daniel Caesar - "Superposition"**
   - Layer 2 (Keywords): Match "soul", "r&b", "jazz", "neo-soul"
   - Layer 3 (Features): Smooth tempo (80-100 BPM), rich harmonies, piano
   - Expected: 7-10 soul/jazz MIDIs with ~0.70-0.80 confidence

### Performance Optimization

**Caching Strategy**:
- Cache extracted MIDI features (avoid re-extraction)
- Cache keyword index (build once, use many times)
- Use pickle/JSON for persistence across runs

**Sampling Strategy**:
- Don't extract features from ALL MIDIs (too slow)
- Sample ~2000-5000 representative MIDIs
- Use stratified sampling (different artists, eras, styles)

**Incremental Matching**:
- Stop at first successful layer (don't continue if good match found)
- Use confidence thresholds to determine "good enough"

## Maintaining "Learned Style" Concept

### Why This Preserves Style Learning

1. **Musical Coherence**: Feature matching ensures similar tempo, harmony, rhythm
2. **Genre Consistency**: Keyword matching groups similar styles together
3. **Diverse but Related**: Even fallback maintains stylistic relevance
4. **Confidence Awareness**: Lower-confidence matches can be weighted less during training

### Training Integration

**Weighted Training**:
```python
# Use match confidence to weight training examples
loss_weight = match_confidence ** 2  # Square to emphasize high-confidence

# High confidence (0.9) → weight 0.81
# Medium confidence (0.7) → weight 0.49
# Low confidence (0.5) → weight 0.25
```

**Style Preservation**:
- Exact matches (0.95+): Full weight, core style learning
- Fuzzy matches (0.80-0.94): High weight, style variations
- Keyword matches (0.70-0.85): Medium weight, genre-consistent
- Feature matches (0.60-0.80): Medium weight, musical similarity
- Pattern matches (0.50-0.70): Lower weight, loose association
- Random fallback (0.30-0.50): Minimal weight, diversity only

## Implementation Roadmap

### Phase 1: Foundation (1-2 hours)
- [ ] Add `FallbackConfig` class
- [ ] Implement `build_keyword_index()`
- [ ] Create artist-to-keywords mapping
- [ ] Test keyword indexing on sample MIDIs

### Phase 2: Keyword Matching (2-3 hours)
- [ ] Implement `match_by_keywords()`
- [ ] Add keyword scoring function
- [ ] Test with 4 modern songs
- [ ] Validate match quality

### Phase 3: Feature Matching (3-4 hours)
- [ ] Implement `build_feature_cache()`
- [ ] Create genre feature profiles
- [ ] Implement `match_by_features()`
- [ ] Add feature distance calculation
- [ ] Test feature matching

### Phase 4: Integration (2-3 hours)
- [ ] Implement `enhanced_fallback_pipeline()`
- [ ] Add confidence scoring for all layers
- [ ] Integrate with existing `match_tracks()` function
- [ ] Add comprehensive logging

### Phase 5: Testing & Refinement (2-3 hours)
- [ ] Test with 4 modern songs
- [ ] Validate match quality and confidence scores
- [ ] Adjust thresholds based on results
- [ ] Document parameters for user adjustment

**Total Estimated Time**: 10-15 hours

## Success Metrics

1. **Match Rate**: >= 80% of unmatched songs get decent fallback (confidence >= 0.6)
2. **Musical Relevance**: Manual review shows stylistic similarity
3. **Diversity**: Multiple different MIDIs per song (not all from same artist)
4. **Confidence Accuracy**: Higher-confidence matches are perceptibly better
5. **Training Effectiveness**: Model learns coherent style despite partial matches

## Conclusion

This enhanced strategy transforms the fallback mechanism from **random sampling** to **intelligent musical matching**, maintaining the "learned style" concept even for modern songs not in the dataset. By progressively using keywords, musical features, and filename patterns, the system provides musically coherent fallback matches with appropriate confidence scores for weighted training.
