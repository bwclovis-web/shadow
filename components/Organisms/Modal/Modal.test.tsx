import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import Modal from "./Modal"

describe("Modal", () => {
  beforeEach(() => {
    // Create the modal portal element
    const portalElement = document.createElement("div")
    portalElement.setAttribute("id", "modal-portal")
    document.body.appendChild(portalElement)
  })

  it("renders a modal", () => {
    render(<Modal isOpen={true}>Test Modal Content</Modal>)
    expect(screen.getByText("Test Modal Content")).toBeInTheDocument()
  })
})
