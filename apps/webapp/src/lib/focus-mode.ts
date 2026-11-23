import { useLocation } from "react-router-dom";
import { findLesson, getCourse } from "@/data/courses";
import { useStore } from "@/store/store";

/**
 * True when focus mode is on AND the current page is a lesson that has a video. Focus mode hides the site
 * navigation, so it only applies where its toggle (on the video) is available to turn it off again.
 */
export function useFocusActive() {
  const pref = useStore((s) => s.focusMode);
  const { pathname } = useLocation();
  const m = pathname.match(/^\/learn\/([^/]+)\/([^/]+)$/);
  if (!pref || !m) return false;
  const course = getCourse(m[1]);
  const lesson = course && findLesson(course, m[2]);
  return !!lesson?.lesson.videos?.length;
}
