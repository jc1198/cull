export default function TasteBanner({ onContinue }) {
  return (
    <div className="w-full flex items-center justify-between border border-border rounded-lg px-6 py-4">
      <div>
        <p className="text-sm font-semibold text-primary">
          Set your taste before Cull makes its first pass
        </p>
        <p className="text-sm text-muted mt-1">
          Describe the mood, subject, or style you're going for
        </p>
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="ml-10 shrink-0 px-4 py-2 text-sm font-medium text-primary border border-border rounded-md bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
      >
        Continue →
      </button>
    </div>
  )
}
