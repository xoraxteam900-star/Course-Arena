import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Poll, getUserVoteForPoll, voteOnPoll } from "@/services/polls";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

interface CommunityPollCardProps {
  poll: Poll;
  onVoted?: () => void;
}

export function CommunityPollCard({ poll, onVoted }: CommunityPollCardProps) {
  const { profile } = useAuth();
  const { isDark } = useTheme();

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [userVotedOptionId, setUserVotedOptionId] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [checkingVote, setCheckingVote] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);

  // Check if current user already voted on this poll
  useEffect(() => {
    let active = true;
    if (!profile?.uid) {
      setCheckingVote(false);
      return;
    }

    getUserVoteForPoll(poll.id, profile.uid).then((optionId) => {
      if (active) {
        setUserVotedOptionId(optionId);
        setCheckingVote(false);
      }
    });

    return () => {
      active = false;
    };
  }, [poll.id, profile?.uid]);

  // Real-time Countdown Timer
  useEffect(() => {
    function updateTimer() {
      if (!poll.expiresAt) {
        setTimeLeft("Ongoing");
        return;
      }

      const expiryMs = poll.expiresAt.toMillis
        ? poll.expiresAt.toMillis()
        : new Date(poll.expiresAt).getTime();
      const diff = expiryMs - Date.now();

      if (diff <= 0) {
        setTimeLeft("Ended");
        setIsExpired(true);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);

        if (days > 0) {
          setTimeLeft(`${days}d ${hours}h left`);
        } else if (hours > 0) {
          setTimeLeft(`${hours}h ${mins}m left`);
        } else {
          setTimeLeft(`${mins}m left`);
        }
      }
    }

    updateTimer();
    const interval = setInterval(updateTimer, 30000); // update every 30s
    return () => clearInterval(interval);
  }, [poll.expiresAt]);

  const hasVoted = Boolean(userVotedOptionId);
  const totalVotes = poll.totalVotes || 0;
  const pollEnded = isExpired || poll.status === "ended";

  async function handleCastVote() {
    if (!profile?.uid) {
      Alert.alert("Sign In Required", "Please sign in to cast your vote.");
      return;
    }
    if (!selectedOptionId) {
      Alert.alert("Choose an option", "Please select an option before submitting.");
      return;
    }

    setVoting(true);
    try {
      await voteOnPoll(poll.id, selectedOptionId, profile.uid);
      setUserVotedOptionId(selectedOptionId);
      onVoted?.();
    } catch (err: any) {
      Alert.alert("Voting Failed", err.message || "Could not record vote.");
    } finally {
      setVoting(false);
    }
  }

  // Color tokens
  const cardBg = isDark ? "#0E1626" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(99, 102, 241, 0.25)" : "#E2E8F0";
  const textColor = isDark ? "#FFFFFF" : "#0F172A";
  const textDimColor = isDark ? "#94A3B8" : "#64748B";

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      {/* Top Banner Row */}
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <View style={[styles.liveDot, { backgroundColor: pollEnded ? "#EF4444" : "#10B981" }]} />
          <Text style={[styles.badgeText, { color: pollEnded ? "#EF4444" : "#10B981" }]}>
            {pollEnded ? "Poll Ended" : "Live Community Vote"}
          </Text>
        </View>

        <View style={styles.timerPill}>
          <Ionicons name="time-outline" size={13} color="#A5B4FC" />
          <Text style={styles.timerText}>{timeLeft}</Text>
        </View>
      </View>

      {/* Question */}
      <Text style={[styles.question, { color: textColor }]}>{poll.question}</Text>

      {/* Options List */}
      {checkingVote ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="small" color="#6366F1" />
        </View>
      ) : (
        <View style={styles.optionsContainer}>
          {poll.options.map((option) => {
            const votes = option.votes || 0;
            const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const isSelected = selectedOptionId === option.id;
            const isUserVote = userVotedOptionId === option.id;

            // Mode 1: Results view (if user voted or poll ended)
            if (hasVoted || pollEnded) {
              return (
                <View
                  key={option.id}
                  style={[
                    styles.resultOptionCard,
                    isUserVote && styles.userVoteBorder,
                    { backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#F8FAFC" },
                  ]}
                >
                  {/* Animated / Fill Bar */}
                  <View
                    style={[
                      styles.fillBar,
                      {
                        width: `${percent}%`,
                        backgroundColor: isUserVote
                          ? "rgba(99, 102, 241, 0.28)"
                          : isDark
                          ? "rgba(255, 255, 255, 0.07)"
                          : "rgba(99, 102, 241, 0.12)",
                      },
                    ]}
                  />

                  {/* Text Content */}
                  <View style={styles.resultOptionContent}>
                    <View style={styles.resultTextCol}>
                      <Text style={[styles.optionText, { color: textColor }]}>
                        {option.text}
                      </Text>
                      {isUserVote && (
                        <View style={styles.yourVoteBadge}>
                          <Ionicons name="checkmark-circle" size={13} color="#6366F1" />
                          <Text style={styles.yourVoteText}>Your Vote</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.resultStatsCol}>
                      <Text style={[styles.percentText, { color: isUserVote ? "#818CF8" : textColor }]}>
                        {percent}%
                      </Text>
                      <Text style={[styles.votesCountText, { color: textDimColor }]}>
                        {votes} {votes === 1 ? "vote" : "votes"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }

            // Mode 2: Voting view (Interactive selection)
            return (
              <Pressable
                key={option.id}
                style={[
                  styles.voteOptionCard,
                  isSelected && styles.voteOptionCardSelected,
                  { backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#F8FAFC" },
                ]}
                onPress={() => setSelectedOptionId(option.id)}
              >
                <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.optionText, { color: textColor }]}>{option.text}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Footer Row */}
      <View style={styles.footerRow}>
        <Text style={[styles.totalVotesText, { color: textDimColor }]}>
          👥 {totalVotes.toLocaleString()} {totalVotes === 1 ? "total vote" : "total votes"}
        </Text>

        {!hasVoted && !pollEnded && (
          <Pressable
            style={[
              styles.voteBtn,
              !selectedOptionId && styles.voteBtnDisabled,
            ]}
            onPress={handleCastVote}
            disabled={voting || !selectedOptionId}
          >
            {voting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={13} color="#FFFFFF" />
                <Text style={styles.voteBtnText}>Vote</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: "#6366F1",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerText: {
    color: "#A5B4FC",
    fontSize: 11,
    fontWeight: "600",
  },
  question: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    marginBottom: 14,
  },
  optionsContainer: {
    gap: 10,
    marginBottom: 14,
  },
  voteOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  voteOptionCardSelected: {
    borderColor: "#6366F1",
    backgroundColor: "rgba(99, 102, 241, 0.08)",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#64748B",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    borderColor: "#6366F1",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6366F1",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  resultOptionCard: {
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    minHeight: 52,
    justifyContent: "center",
  },
  userVoteBorder: {
    borderColor: "#6366F1",
    borderWidth: 1.5,
  },
  fillBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 14,
  },
  resultOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 1,
  },
  resultTextCol: {
    flex: 1,
    gap: 3,
    paddingRight: 10,
  },
  yourVoteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  yourVoteText: {
    color: "#818CF8",
    fontSize: 11,
    fontWeight: "700",
  },
  resultStatsCol: {
    alignItems: "flex-end",
  },
  percentText: {
    fontSize: 15,
    fontWeight: "800",
  },
  votesCountText: {
    fontSize: 11,
    fontWeight: "500",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  totalVotesText: {
    fontSize: 12,
    fontWeight: "600",
  },
  voteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#5B4DFF",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
  },
  voteBtnDisabled: {
    opacity: 0.5,
  },
  voteBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  loadingWrapper: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
