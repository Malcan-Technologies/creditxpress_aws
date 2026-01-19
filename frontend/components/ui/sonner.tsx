"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-slate-600",
          actionButton:
            "group-[.toast]:bg-teal-500 group-[.toast]:text-white group-[.toast]:hover:bg-teal-600",
          cancelButton:
            "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-700 group-[.toast]:hover:bg-slate-200",
          success:
            "group-[.toaster]:bg-white group-[.toaster]:border-teal-500/50",
          error:
            "group-[.toaster]:bg-white group-[.toaster]:border-red-500/50",
          warning:
            "group-[.toaster]:bg-white group-[.toaster]:border-amber-500/50",
          info:
            "group-[.toaster]:bg-white group-[.toaster]:border-cyan-500/50",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
