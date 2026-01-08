export default function getSinceDate(hours, now = new Date()) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}
