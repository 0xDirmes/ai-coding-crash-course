import { useSearchParams } from "react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

/**
 * Admin-only picker that opens the chosen instructor's dashboard by setting
 * `?instructorId=`. Other search params (e.g. `range`) are preserved.
 */
export function InstructorPicker({
  instructors,
}: {
  instructors: { id: number; name: string }[];
}) {
  const [, setSearchParams] = useSearchParams();

  if (instructors.length === 0) {
    return <p className="text-sm text-muted-foreground">No instructors yet.</p>;
  }

  function handleChange(value: string) {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.set("instructorId", value);
      return next;
    });
  }

  return (
    <Select onValueChange={handleChange}>
      <SelectTrigger className="w-72" aria-label="Instructor">
        <SelectValue placeholder="Select an instructor" />
      </SelectTrigger>
      <SelectContent>
        {instructors.map((instructor) => (
          <SelectItem key={instructor.id} value={String(instructor.id)}>
            {instructor.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
