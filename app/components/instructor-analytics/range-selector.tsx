import { useSearchParams } from "react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ANALYTICS_RANGES,
  ANALYTICS_RANGE_LABELS,
  type AnalyticsRange,
} from "~/lib/analytics-range";

/**
 * Time-range picker stored in `?range=`. Other search params (e.g. an admin's
 * `instructorId`) are preserved when the range changes.
 */
export function RangeSelector({ range }: { range: AnalyticsRange }) {
  const [, setSearchParams] = useSearchParams();

  function handleChange(value: string) {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.set("range", value);
      return next;
    });
  }

  return (
    <Select value={range} onValueChange={handleChange}>
      <SelectTrigger className="w-40" aria-label="Time range">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ANALYTICS_RANGES.map((value) => (
          <SelectItem key={value} value={value}>
            {ANALYTICS_RANGE_LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
