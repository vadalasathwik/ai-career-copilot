"use client"

import { useState } from "react"

export default function ResumeUpload() {

  const [fileName, setFileName] = useState("")

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {

    const file = event.target.files?.[0]

    if (file) {
      setFileName(file.name)
    }

  }

  return (
    <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800">

      <h2 className="text-2xl font-semibold mb-4">
        Upload Resume
      </h2>

      <label
        className="border-2 border-dashed border-neutral-700 p-10 rounded-xl text-center block cursor-pointer hover:border-white transition"
      >

        <input
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        {
          fileName ? (
            <p className="text-green-400">
              Uploaded: {fileName}
            </p>
          ) : (
            <p className="text-neutral-400">
              Click to upload your resume
            </p>
          )
        }

      </label>

    </div>
  )
}