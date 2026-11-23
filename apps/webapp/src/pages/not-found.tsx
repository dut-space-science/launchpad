import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="text-6xl font-bold text-gold">404</div>
      <h1 className="mt-2 text-2xl font-bold">Off trajectory</h1>
      <p className="mt-2 text-muted-foreground">
        That page does not exist or the course has moved.
      </p>
      <Link to="/" className={buttonVariants({ className: "mt-6" })}>
        Back to Launchpad
      </Link>
    </div>
  );
}
