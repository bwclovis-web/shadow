import React, { useMemo, useState } from "react"

import { VirtualScroll } from "~/components/Containers/VirtualScroll"
import { VirtualScrollList } from "~/components/Molecules/VirtualScrollList"

// Generate demo data
const generateDemoData = (count: number) => Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Demo Item ${i + 1}`,
    description: `This is a demo item with index ${i + 1}`,
    category: ["Category A", "Category B", "Category C"][i % 3],
    value: Math.floor(Math.random() * 1000),
  }))

const DemoItem = ({ item, index }: { item: any; index: number }) => (
  <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-2">
      <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
      <span className="text-sm text-gray-500">#{index + 1}</span>
    </div>
    <p className="text-gray-600 mb-2">{item.description}</p>
    <div className="flex justify-between items-center">
      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
        {item.category}
      </span>
      <span className="text-lg font-bold text-green-600">${item.value}</span>
    </div>
  </div>
)

const VirtualScrollDemo: React.FC = () => {
  const [itemCount, setItemCount] = useState(1000)
  const [containerHeight, setContainerHeight] = useState(400)
  const [itemHeight, setItemHeight] = useState(120)
  const [useVirtualScrolling, setUseVirtualScrolling] = useState(true)

  const demoData = useMemo(() => generateDemoData(itemCount), [itemCount])

  const renderItem = (item: any, index: number) => (
    <DemoItem key={item.id} item={item} index={index} />
  )

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Virtual Scrolling Demo
      </h1>

      {/* Controls */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Count: {itemCount}
            </label>
            <input
              type="range"
              min="100"
              max="10000"
              step="100"
              value={itemCount}
              onChange={e => setItemCount(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Container Height: {containerHeight}px
            </label>
            <input
              type="range"
              min="200"
              max="800"
              step="50"
              value={containerHeight}
              onChange={e => setContainerHeight(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Height: {itemHeight}px
            </label>
            <input
              type="range"
              min="60"
              max="200"
              step="10"
              value={itemHeight}
              onChange={e => setItemHeight(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="virtual-scrolling"
              checked={useVirtualScrolling}
              onChange={e => setUseVirtualScrolling(e.target.checked)}
              className="mr-2"
            />
            <label
              htmlFor="virtual-scrolling"
              className="text-sm font-medium text-gray-700"
            >
              Use Virtual Scrolling
            </label>
          </div>
        </div>
      </div>

      {/* Performance Info */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">
          Performance Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium">Total Items:</span>{" "}
            {itemCount.toLocaleString()}
          </div>
          <div>
            <span className="font-medium">Visible Items:</span>{" "}
            {Math.ceil(containerHeight / itemHeight)}
          </div>
          <div>
            <span className="font-medium">Rendered Items:</span>{" "}
            {useVirtualScrolling
              ? Math.ceil(containerHeight / itemHeight) + 10
              : itemCount}
          </div>
        </div>
      </div>

      {/* Demo Container */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-2 border-b">
          <h3 className="font-semibold text-gray-700">
            {useVirtualScrolling ? "Virtual Scrolling" : "Regular Rendering"} -{" "}
            {itemCount} items
          </h3>
        </div>

        {useVirtualScrolling ? (
          <VirtualScrollList
            items={demoData}
            itemHeight={itemHeight}
            containerHeight={containerHeight}
            overScan={5}
            className="p-4"
            renderItem={renderItem}
            itemClassName="mb-4"
            emptyState={
              <div className="p-8 text-center text-gray-500">
                No items to display
              </div>
            }
          />
        ) : (
          <div className="p-4 overflow-y-auto" style={{ height: containerHeight }}>
            {demoData.map((item, index) => (
              <div key={item.id} className="mb-4" style={{ height: itemHeight }}>
                {renderItem(item, index)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">Instructions</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>
            • Adjust the sliders to change the number of items, container height, and
            item height
          </li>
          <li>
            • Toggle virtual scrolling on/off to see the performance difference
          </li>
          <li>
            • With virtual scrolling enabled, only visible items are rendered in the
            DOM
          </li>
          <li>• Try scrolling with large datasets to see the smooth performance</li>
          <li>
            • Notice how the "Rendered Items" count stays low with virtual scrolling
          </li>
        </ul>
      </div>
    </div>
  )
}

export default VirtualScrollDemo
