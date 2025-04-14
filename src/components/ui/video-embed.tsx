"use client"

import React from "react"

interface VideoEmbedProps {
  url: string
  title: string
  aspectRatio?: "16:9" | "4:3" | "1:1"
}

export function VideoEmbed({ url, title, aspectRatio = "16:9" }: VideoEmbedProps) {
  // Calculate padding-top based on aspect ratio
  const paddingTopMap = {
    "16:9": "56.25%",
    "4:3": "75%",
    "1:1": "100%"
  }
  
  const paddingTop = paddingTopMap[aspectRatio]

  return (
    <div className="w-full">
      <div style={{ position: "relative", paddingTop, overflow: "hidden" }}>
        <iframe
          src={url}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute top-0 left-0 w-full h-full border-0"
        />
      </div>
    </div>
  )
} 