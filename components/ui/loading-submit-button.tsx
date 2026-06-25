"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LoadingSubmitButtonProps = ComponentProps<typeof Button> & {
  loadingText?: string;
};

export default function LoadingSubmitButton({
  children,
  loadingText = "Уншиж байна...",
  className,
  disabled,
  ...props
}: LoadingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      className={cn(
        "gap-2 rounded-lg bg-[#8B5E3C] px-5 py-2 text-white shadow-sm transition-all duration-200 hover:bg-[#734d31] disabled:cursor-not-allowed disabled:bg-stone-300",
        className
      )}
      {...props}
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
