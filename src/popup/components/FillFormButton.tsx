export const FillFormButton = () => {
  const onFillFormClick = () => {
    // Placeholder action until form-filling logic is implemented.
    console.info("Fill Form clicked")
  }

  return (
    <button
      className="w-full rounded-lg bg-blue-600 px-3.5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      onClick={onFillFormClick}
      type="button">
      Fill Form
    </button>
  )
}
