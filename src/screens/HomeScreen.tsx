import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import classroomHero from "../../assets/learning-classroom-hero.png";
import type { AppRoute } from "../components/NavigationBar";
import { colors, spacing } from "../theme/tokens";

const tasks = [
  {
    route: "check",
    title: "Check a text",
    description: "Paste a passage or scan printed English, then review the words in context.",
  },
  {
    route: "browse",
    title: "Find words",
    description: "Explore word families, frequency and textbook observations for your lesson.",
  },
  {
    route: "list",
    title: "Build a teaching list",
    description: "Keep your selected words and notes together, then export your plan.",
  },
] as const;

export function HomeScreen({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  const { width } = useWindowDimensions();
  const wide = width >= 840;
  const contentWidth = Math.min(width, 1180) - spacing.lg * 2;
  const imageHeight = (wide ? (contentWidth - spacing.lg) / 2 : contentWidth) / 1.5;
  return (
    <View style={styles.content}>
      <Text style={styles.brand}>HK-ELE · Hong Kong English Language Education</Text>
      <View style={[styles.hero, wide && styles.heroWide]}>
        <View style={[styles.introduction, wide && styles.half]}>
          <Text style={styles.eyebrow}>FOR TEACHERS, WITH LEARNERS IN MIND</Text>
          <Text
            accessibilityRole="header"
            aria-level={1}
            style={[styles.heading, wide && styles.headingWide]}
          >
            Find the words your lesson needs.
          </Text>
          <Text style={styles.description}>
            HK-ELE helps you choose vocabulary, check classroom reading and plan what to teach.
            Explore word information and evidence from Hong Kong English and textbooks, then use
            your knowledge of your students to make the final choice.
          </Text>
        </View>
        <View style={[styles.illustration, wide && styles.half]}>
          <Image
            accessibilityLabel="A teacher and learners reviewing English vocabulary together with books and a laptop"
            resizeMode="contain"
            source={classroomHero}
            style={[styles.image, { height: imageHeight }]}
          />
        </View>
      </View>
      <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>
        Start with your lesson
      </Text>
      <View style={styles.tasks}>
        {tasks.map((task, index) => (
          <Pressable
            accessibilityLabel={`Start ${task.title}`}
            accessibilityRole="button"
            key={task.route}
            onPress={() => onNavigate(task.route)}
            style={({ pressed }) => [
              styles.task,
              index === 0 && styles.primaryTask,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.number}>0{index + 1}</Text>
            <Text style={styles.taskTitle}>{task.title} →</Text>
            <Text style={styles.taskDescription}>{task.description}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  content: {
    alignSelf: "center",
    gap: spacing.lg,
    maxWidth: 1180,
    padding: spacing.lg,
    width: "100%",
  },
  brand: { color: colors.primary, fontSize: 16, fontWeight: "600", lineHeight: 24 },
  hero: { gap: spacing.lg, alignItems: "stretch" },
  heroWide: { flexDirection: "row", alignItems: "center" },
  introduction: { gap: spacing.md, minWidth: 0 },
  half: { flex: 1 },
  eyebrow: { color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 21 },
  heading: { color: colors.ink, fontSize: 34, fontWeight: "700", lineHeight: 41 },
  headingWide: { fontSize: 46, lineHeight: 54 },
  description: { color: colors.ink, fontSize: 18, lineHeight: 28 },
  illustration: {
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#F3EBDD",
    minWidth: 0,
  },
  image: { width: "100%", aspectRatio: 1.5 },
  sectionTitle: { color: colors.ink, fontSize: 23, fontWeight: "600", lineHeight: 30 },
  tasks: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  task: {
    flex: 1,
    minWidth: 240,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.md,
    minHeight: 160,
  },
  primaryTask: { backgroundColor: "#e7f2eb", borderColor: "#b4d2c0" },
  number: { color: colors.primary, fontSize: 16, fontWeight: "600", lineHeight: 23 },
  taskTitle: { color: colors.ink, fontSize: 21, fontWeight: "600", lineHeight: 28 },
  taskDescription: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  note: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  pressed: { opacity: 0.75 },
});
