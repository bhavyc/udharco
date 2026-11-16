/**
 * NameMatchService
 * 
 * Production-Grade Fuzzy Name Matching Engine for Fintech KYC / Penny-Drop Verification.
 * Prevents third-party bank account fraud by comparing the registered business GST Legal Name
 * against the bank account holder's name returned by NPCI/IMPS core banking.
 * 
 * Features:
 * 1. Corporate Suffix & Noise Normalization (PVT LTD, PRIVATE LIMITED, LLP, CO, etc.)
 * 2. Token-Sort Similarity Ratio (word order independent)
 * 3. Jaccard Token Overlap & Substring Containment Bonus
 * 4. Configurable threshold (Default 70% per RBI fintech KYC best practices)
 */

export interface NameMatchDetails {
  tokenSortScore: number;
  tokenOverlapScore: number;
  rawLevenshteinScore: number;
  containmentBonus: boolean;
}

export interface NameMatchResult {
  matchPercentage: number;
  isMatch: boolean;
  threshold: number;
  normalizedLegalName: string;
  normalizedBankName: string;
  details: NameMatchDetails;
}

export class NameMatchService {
  // Configurable threshold: Default 70%
  public static readonly DEFAULT_THRESHOLD = 70;

  // Standard corporate legal entity suffixes and business noise words in India
  private static readonly NOISE_SUFFIXES = [
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
  ];

  /**
   * Normalizes a business or individual name:
   * - Converts to uppercase
   * - Replaces '&' with 'AND'
   * - Removes special characters and punctuation
   * - Strips corporate suffixes (e.g. PVT LTD, PRIVATE LIMITED)
   * - Normalizes multiple spaces
   */
  static normalizeName(rawName: string): string {
    if (!rawName || typeof rawName !== "string") return "";

    let name = rawName.toUpperCase();

    // Standardize ampersands and punctuation
    name = name.replace(/&/g, " AND ");
    name = name.replace(/[^A-Z0-9\s]/g, " ");

    // Normalize spacing
    name = name.replace(/\s+/g, " ").trim();

    // Strip known corporate suffixes from anywhere in the string
    for (const suffix of this.NOISE_SUFFIXES) {
      const regex = new RegExp(`\\b${suffix}\\b`, "g");
      name = name.replace(regex, " ");
    }

    // Strip standalone noise words ("AND", "THE", "OF")
    name = name.replace(/\b(AND|THE|OF)\b/g, " ");

    // Final clean
    return name.replace(/\s+/g, " ").trim();
  }

  /**
   * Calculates Levenshtein edit distance between two strings
   */
  static calculateLevenshteinDistance(str1: string, str2: string): number {
    const s1 = str1.trim();
    const s2 = str2.trim();
    const m = s1.length;
    const n = s2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // Deletion
          dp[i][j - 1] + 1,      // Insertion
          dp[i - 1][j - 1] + cost // Substitution
        );
      }
    }

    return dp[m][n];
  }

  /**
   * Calculates raw string similarity ratio [0..100] based on Levenshtein distance
   */
  static calculateRawSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 100;
    const dist = this.calculateLevenshteinDistance(str1, str2);
    return Math.max(0, Math.round(((maxLen - dist) / maxLen) * 100));
  }

  /**
   * Token-Sort Ratio:
   * Splits normalized names into words, sorts words alphabetically, and compares the sorted strings.
   * This makes comparison immune to word order reordering (e.g. "Raju Steel" vs "Steel Raju").
   */
  static calculateTokenSortScore(norm1: string, norm2: string): number {
    const tokens1 = norm1.split(" ").filter((t) => t.length > 0).sort();
    const tokens2 = norm2.split(" ").filter((t) => t.length > 0).sort();

    const sortedStr1 = tokens1.join(" ");
    const sortedStr2 = tokens2.join(" ");

    return this.calculateRawSimilarity(sortedStr1, sortedStr2);
  }

  /**
   * Token Overlap Ratio (Jaccard Index of words):
   * Measures the percentage of matching root words between both names.
   */
  static calculateTokenOverlapScore(norm1: string, norm2: string): { score: number; isContained: boolean } {
    const set1 = new Set(norm1.split(" ").filter((t) => t.length > 1));
    const set2 = new Set(norm2.split(" ").filter((t) => t.length > 1));

    if (set1.size === 0 || set2.size === 0) {
      return { score: 0, isContained: false };
    }

    let intersectionCount = 0;
    set1.forEach((token) => {
      if (set2.has(token)) {
        intersectionCount++;
      } else {
        // Fuzzy token match for minor typos (e.g. "ANCILLARY" vs "ANCILLARIES")
        for (const t2 of set2) {
          if (this.calculateRawSimilarity(token, t2) >= 80) {
            intersectionCount++;
            break;
          }
        }
      }
    });

    const unionCount = new Set([...set1, ...set2]).size;
    const jaccardScore = Math.round((intersectionCount / unionCount) * 100);

    // Check if the smaller set is fully contained in the larger set (e.g. "MAHINDRA AUTO" inside "MAHINDRA AUTO MOTORS")
    const minSize = Math.min(set1.size, set2.size);
    const isContained = minSize > 0 && intersectionCount >= minSize;

    return { score: jaccardScore, isContained };
  }

  /**
   * Compares a declared GST Legal Entity Name against a Bank Account Beneficiary Name.
   * 
   * @param registeredLegalName e.g. "Raju Steel & Pipes Pvt Ltd"
   * @param bankBeneficiaryName e.g. "RAJU STEEL AND PIPES PRIVATE LIMITED" (or mismatched "Rahul Sharma")
   * @param threshold Minimum match percentage to pass (default 70)
   */
  static compareNames(
    registeredLegalName: string,
    bankBeneficiaryName: string,
    threshold: number = this.DEFAULT_THRESHOLD
  ): NameMatchResult {
    const normLegal = this.normalizeName(registeredLegalName);
    const normBank = this.normalizeName(bankBeneficiaryName);

    // If either name after normalization is empty
    if (!normLegal || !normBank) {
      return {
        matchPercentage: 0,
        isMatch: false,
        threshold,
        normalizedLegalName: normLegal,
        normalizedBankName: normBank,
        details: {
          tokenSortScore: 0,
          tokenOverlapScore: 0,
          rawLevenshteinScore: 0,
          containmentBonus: false,
        },
      };
    }

    // Exact normalized match -> Instant 100%
    if (normLegal === normBank) {
      return {
        matchPercentage: 100,
        isMatch: true,
        threshold,
        normalizedLegalName: normLegal,
        normalizedBankName: normBank,
        details: {
          tokenSortScore: 100,
          tokenOverlapScore: 100,
          rawLevenshteinScore: 100,
          containmentBonus: true,
        },
      };
    }

    const rawScore = this.calculateRawSimilarity(normLegal, normBank);
    const tokenSortScore = this.calculateTokenSortScore(normLegal, normBank);
    const { score: overlapScore, isContained } = this.calculateTokenOverlapScore(normLegal, normBank);

    // Weighted composite score calculation:
    // 50% Token Sort + 40% Token Overlap + 10% Raw Levenshtein
    let compositeScore = Math.round(
      tokenSortScore * 0.50 + overlapScore * 0.40 + rawScore * 0.10
    );

    // Containment Bonus: If all primary words of the bank account are present in the legal business name
    // (e.g. "MAHINDRA AUTO" inside "MAHINDRA AUTO ANCILLARIES"), ensure minimum 85% score
    if (isContained && compositeScore < 85) {
      compositeScore = Math.max(compositeScore, 85);
    }

    const finalMatch = Math.min(100, Math.max(0, compositeScore));
    const isMatch = finalMatch >= threshold;

    return {
      matchPercentage: finalMatch,
      isMatch,
      threshold,
      normalizedLegalName: normLegal,
      normalizedBankName: normBank,
      details: {
        tokenSortScore,
        tokenOverlapScore: overlapScore,
        rawLevenshteinScore: rawScore,
        containmentBonus: isContained,
      },
    };
  }
}
