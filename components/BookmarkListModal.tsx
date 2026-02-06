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
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { BookmarkData } from "../utils/bookmarkStorage";
import { useSettings, getTextSizeMetrics } from "../hooks/useSettings";
import { parseDateLocal } from "../utils/dateUtils";

interface BookmarkListModalProps {
  visible: boolean;
  bookmarks: BookmarkData[];
  onClose: () => void;
  onSelectBookmark: (date: string) => void;
  onRemoveBookmark: (bookmark: BookmarkData) => void;
}

export const BookmarkListModal: React.FC<BookmarkListModalProps> = ({
  visible,
  bookmarks,
  onClose,
  onSelectBookmark,
  onRemoveBookmark,
}) => {
  const { colors } = useTheme();
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
    // Parse as local time to avoid timezone shift
    const date = parseDateLocal(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).toUpperCase();
  };

  const renderBookmarkItem = ({ item }: { item: BookmarkData }) => (
    <TouchableOpacity
      style={[
        styles.bookmarkItem,
        { backgroundColor: colors.pearl, borderColor: colors.mist },
      ]}
      onPress={() => {
        onSelectBookmark(item.date);
        onClose();
      }}
    >
      <View style={styles.bookmarkContent}>
        <Text
          style={[
            styles.bookmarkDate,
            { fontSize: typography.favoriteDateFontSize, color: colors.ocean },
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
              color: colors.ink,
            },
          ]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => onRemoveBookmark(item)}
        style={styles.deleteButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={18} color={colors.deepTeal} />
      </TouchableOpacity>
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
      <Text style={[styles.emptyTitle, { color: colors.ink }]}>No favorites yet</Text>
      <Text style={[styles.emptyMessage, { color: colors.ocean }]}>
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
            { transform: [{ translateY }], backgroundColor: colors.pearl },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.header, { borderBottomColor: colors.mist }]}>
            <Text 
              style={[
                styles.title,
                { fontSize: typography.favoriteFontSize + 10, color: colors.deepTeal }
              ]}
            >
              Favorites
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.doneButton}>
              <Text style={[styles.doneButtonText, { color: colors.deepTeal }]}>Done</Text>
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
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontFamily: fonts.headerFamilyBoldItalic,
    fontSize: 24,
  },
  closeButton: {
    padding: 4,
  },
  doneButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  doneButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
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
    borderWidth: 2,
  },
  bookmarkContent: {
    flex: 1,
  },
  deleteButton: {
    padding: 6,
    marginLeft: 12,
  },
  bookmarkDate: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  bookmarkTitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
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
    marginBottom: 8,
  },
  emptyMessage: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});

