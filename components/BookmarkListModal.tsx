import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { BookmarkData } from "../utils/bookmarkStorage";
import { useSettings, getTextSizeMetrics } from "../hooks/useSettings";

interface BookmarkListModalProps {
  visible: boolean;
  bookmarks: BookmarkData[];
  onClose: () => void;
  onSelectBookmark: (date: string) => void;
}

export const BookmarkListModal: React.FC<BookmarkListModalProps> = ({
  visible,
  bookmarks,
  onClose,
  onSelectBookmark,
}) => {
  const { settings } = useSettings();
  const typography = getTextSizeMetrics(settings.textSize);
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).toUpperCase();
  };

  const renderBookmarkItem = ({ item }: { item: BookmarkData }) => (
    <TouchableOpacity
      style={styles.bookmarkItem}
      onPress={() => {
        onSelectBookmark(item.date);
        onClose();
      }}
    >
      <View style={styles.bookmarkContent}>
        <Text
          style={[
            styles.bookmarkDate,
            { fontSize: typography.favoriteDateFontSize },
          ]}
        >
          {formatDate(item.date)}
        </Text>
        <Text
          style={[
            styles.bookmarkTitle,
            {
              fontSize: typography.favoriteFontSize,
              lineHeight: typography.favoriteLineHeight,
            },
          ]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="heart-outline"
        size={64}
        color={colors.mist}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyTitle}>No favorites yet</Text>
      <Text style={styles.emptyMessage}>
        Long press any reading to add it to your favorites
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY }] },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text 
              style={[
                styles.title,
                { fontSize: typography.favoriteFontSize + 10 }
              ]}
            >
              Favorites
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </TouchableOpacity>
          </View>

          {bookmarks.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={bookmarks}
              renderItem={renderBookmarkItem}
              keyExtractor={(item) => item.date}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    paddingBottom: 82,
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.mist,
  },
  title: {
    fontFamily: fonts.headerFamilyBoldItalic,
    fontSize: 24,
    color: colors.deepTeal,
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    padding: 20,
  },
  bookmarkItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(90, 124, 126, 0.1)",
  },
  bookmarkContent: {
    flex: 1,
  },
  bookmarkDate: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    color: colors.ocean,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  bookmarkTitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: colors.deepTeal,
    lineHeight: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: fonts.headerFamilyBoldItalic,
    fontSize: 20,
    color: colors.ink,
    marginBottom: 8,
  },
  emptyMessage: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    color: colors.ocean,
    textAlign: "center",
    lineHeight: 22,
  },
});

