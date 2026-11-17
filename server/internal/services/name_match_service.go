package services

import (
	"math"
	"regexp"
	"sort"
	"strings"
)

type NameMatchDetails struct {
	TokenSortScore      int  `json:"tokenSortScore"`
	TokenOverlapScore   int  `json:"tokenOverlapScore"`
	RawLevenshteinScore int  `json:"rawLevenshteinScore"`
	ContainmentBonus    bool `json:"containmentBonus"`
}

type NameMatchResult struct {
	MatchPercentage     int              `json:"matchPercentage"`
	IsMatch             bool             `json:"isMatch"`
	Threshold           int              `json:"threshold"`
	NormalizedLegalName string           `json:"normalizedLegalName"`
	NormalizedBankName  string           `json:"normalizedBankName"`
	Details             NameMatchDetails `json:"details"`
}

type NameMatchService struct{}

var noiseSuffixes = []string{
	"PRIVATE LIMITED",
	"PVT LIMITED",
	"PVT LTD",
	"PRIVATE LTD",
	"LIMITED LIABILITY PARTNERSHIP",
	"LIMITED",
	"LTD",
	"LLP",
	"PROPRIETORSHIP",
	"PROP",
	"ENTERPRISES",
	"ENTERPRISE",
	"CORPORATION",
	"CORP",
	"COMPANY",
	"CO",
	"HOLDINGS",
	"HOLDING",
	"INDUSTRIES",
	"INDUSTRY",
	"TRADERS",
	"TRADING",
	"SERVICES",
	"SERVICE",
	"SOLUTIONS",
	"SOLUTION",
	"WORKS",
	"VENTURES",
	"VENTURE",
	"GROUP",
	"AGENCY",
	"AGENCIES",
	"INC",
}

// NormalizeName strips corporate suffixes, special characters, and noise words
func (s *NameMatchService) NormalizeName(rawName string) string {
	if rawName == "" {
		return ""
	}

	name := strings.ToUpper(rawName)

	// Replace & with AND
	name = strings.ReplaceAll(name, "&", " AND ")

	// Strip non-alphanumeric characters
	nonAlpha := regexp.MustCompile(`[^A-Z0-9\s]`)
	name = nonAlpha.ReplaceAllString(name, " ")

	// Normalize multiple spaces
	spaces := regexp.MustCompile(`\s+`)
	name = spaces.ReplaceAllString(name, " ")
	name = strings.TrimSpace(name)

	// Strip corporate legal suffixes
	for _, suffix := range noiseSuffixes {
		re := regexp.MustCompile(`\b` + suffix + `\b`)
		name = re.ReplaceAllString(name, " ")
	}

	// Strip standalone noise words ("AND", "THE", "OF")
	noiseWords := regexp.MustCompile(`\b(AND|THE|OF)\b`)
	name = noiseWords.ReplaceAllString(name, " ")

	name = spaces.ReplaceAllString(name, " ")
	return strings.TrimSpace(name)
}

// CalculateLevenshteinDistance computes classic Wagner-Fischer edit distance
func (s *NameMatchService) CalculateLevenshteinDistance(str1, str2 string) int {
	s1 := strings.TrimSpace(str1)
	s2 := strings.TrimSpace(str2)
	m := len(s1)
	n := len(s2)

	if m == 0 {
		return n
	}
	if n == 0 {
		return m
	}

	dp := make([][]int, m+1)
	for i := range dp {
		dp[i] = make([]int, n+1)
		dp[i][0] = i
	}
	for j := 0; j <= n; j++ {
		dp[0][j] = j
	}

	for i := 1; i <= m; i++ {
		for j := 1; j <= n; j++ {
			cost := 0
			if s1[i-1] != s2[j-1] {
				cost = 1
			}
			dp[i][j] = min(
				dp[i-1][j]+1,      // deletion
				dp[i][j-1]+1,      // insertion
				dp[i-1][j-1]+cost, // substitution
			)
		}
	}

	return dp[m][n]
}

func min(a, b, c int) int {
	if a < b && a < c {
		return a
	}
	if b < c {
		return b
	}
	return c
}

// CalculateRawSimilarity computes raw character-level similarity [0..100]
func (s *NameMatchService) CalculateRawSimilarity(str1, str2 string) int {
	maxLen := len(str1)
	if len(str2) > maxLen {
		maxLen = len(str2)
	}
	if maxLen == 0 {
		return 100
	}
	dist := s.CalculateLevenshteinDistance(str1, str2)
	score := int(math.Round((float64(maxLen-dist) / float64(maxLen)) * 100))
	if score < 0 {
		return 0
	}
	return score
}

// CalculateTokenSortScore sorts words alphabetically and compares sorted strings
func (s *NameMatchService) CalculateTokenSortScore(norm1, norm2 string) int {
	tokens1 := strings.Fields(norm1)
	tokens2 := strings.Fields(norm2)

	sort.Strings(tokens1)
	sort.Strings(tokens2)

	sortedStr1 := strings.Join(tokens1, " ")
	sortedStr2 := strings.Join(tokens2, " ")

	return s.CalculateRawSimilarity(sortedStr1, sortedStr2)
}

// CalculateTokenOverlap computes Jaccard word overlap and containment
func (s *NameMatchService) CalculateTokenOverlap(norm1, norm2 string) (int, bool) {
	tokens1 := strings.Fields(norm1)
	tokens2 := strings.Fields(norm2)

	set1 := make(map[string]bool)
	for _, t := range tokens1 {
		if len(t) > 1 {
			set1[t] = true
		}
	}

	set2 := make(map[string]bool)
	for _, t := range tokens2 {
		if len(t) > 1 {
			set2[t] = true
		}
	}

	if len(set1) == 0 || len(set2) == 0 {
		return 0, false
	}

	intersectionCount := 0
	for t1 := range set1 {
		if set2[t1] {
			intersectionCount++
		} else {
			// Fuzzy token match for minor plurals/endings
			for t2 := range set2 {
				if s.CalculateRawSimilarity(t1, t2) >= 80 {
					intersectionCount++
					break
				}
			}
		}
	}

	allTokens := make(map[string]bool)
	for t := range set1 {
		allTokens[t] = true
	}
	for t := range set2 {
		allTokens[t] = true
	}

	jaccard := int(math.Round((float64(intersectionCount) / float64(len(allTokens))) * 100))
	minSize := len(set1)
	if len(set2) < minSize {
		minSize = len(set2)
	}
	isContained := minSize > 0 && intersectionCount >= minSize

	return jaccard, isContained
}

// CompareNames computes the final composite fuzzy name matching score
func (s *NameMatchService) CompareNames(registeredLegalName, bankBeneficiaryName string, threshold int) NameMatchResult {
	if threshold <= 0 {
		threshold = 70
	}

	normLegal := s.NormalizeName(registeredLegalName)
	normBank := s.NormalizeName(bankBeneficiaryName)

	if normLegal == "" || normBank == "" {
		return NameMatchResult{
			MatchPercentage:     0,
			IsMatch:             false,
			Threshold:           threshold,
			NormalizedLegalName: normLegal,
			NormalizedBankName:  normBank,
		}
	}

	// Exact normalized match -> Instant 100%
	if normLegal == normBank {
		return NameMatchResult{
			MatchPercentage:     100,
			IsMatch:             true,
			Threshold:           threshold,
			NormalizedLegalName: normLegal,
			NormalizedBankName:  normBank,
			Details: NameMatchDetails{
				TokenSortScore:      100,
				TokenOverlapScore:   100,
				RawLevenshteinScore: 100,
				ContainmentBonus:    true,
			},
		}
	}

	rawScore := s.CalculateRawSimilarity(normLegal, normBank)
	tokenSortScore := s.CalculateTokenSortScore(normLegal, normBank)
	overlapScore, isContained := s.CalculateTokenOverlap(normLegal, normBank)

	// Composite weighting: 50% Token Sort + 40% Token Overlap + 10% Raw Levenshtein
	composite := int(math.Round(
		float64(tokenSortScore)*0.50 + float64(overlapScore)*0.40 + float64(rawScore)*0.10,
	))

	// Containment bonus: If all primary words of one are inside the other
	if isContained && composite < 85 {
		composite = 85
	}

	if composite > 100 {
		composite = 100
	}
	if composite < 0 {
		composite = 0
	}

	return NameMatchResult{
		MatchPercentage:     composite,
		IsMatch:             composite >= threshold,
		Threshold:           threshold,
		NormalizedLegalName: normLegal,
		NormalizedBankName:  normBank,
		Details: NameMatchDetails{
			TokenSortScore:      tokenSortScore,
			TokenOverlapScore:   overlapScore,
			RawLevenshteinScore: rawScore,
			ContainmentBonus:    isContained,
		},
	}
}
