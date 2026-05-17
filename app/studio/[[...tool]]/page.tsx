"use client"

import { NextStudio } from "next-sanity/studio"

import config from "@/sanity/sanity.config"

const StudioPage = () => <NextStudio config={config} />

export default StudioPage
