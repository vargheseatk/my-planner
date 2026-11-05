import type { ReactNode } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from './icons'

// Drag starts only from the grip, so taps, typing and page scrolling elsewhere are untouched.
// The grip has touch-action: none, which lets a finger drag it straight away on phones.
export function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

export function Grip(props: Record<string, unknown>) {
  return (
    <button type="button" className="grip" aria-label="Drag to reorder" {...props}>
      <Icon name="grip" size={16} />
    </button>
  )
}

// A vertical list you reorder by dragging each row's grip. onReorder gets the new order.
export function SortableList<T>({
  items,
  id,
  onReorder,
  className = '',
  children,
}: {
  items: T[]
  id: (item: T, index: number) => string
  onReorder: (next: T[]) => void
  className?: string
  children: (item: T, grip: ReactNode, index: number) => ReactNode
}) {
  const sensors = useDragSensors()
  const ids = items.map(id)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onReorder(arrayMove(items, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, i) => (
            <SortableItem key={ids[i]} id={ids[i]}>
              {(grip) => children(item, grip, i)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export function SortableItem({ id, className = '', children }: { id: string; className?: string; children: (grip: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} className={`sortable ${isDragging ? 'dragging' : ''} ${className}`} style={{ transform: CSS.Translate.toString(transform), transition }}>
      {children(<Grip ref={setActivatorNodeRef} {...attributes} {...listeners} />)}
    </div>
  )
}

// Sort patches for rows whose position changed, for store.updateMany.
export function sortPatches<T extends { id: string; sort: number }>(next: T[]) {
  return next.flatMap((r, sort) => (r.sort === sort ? [] : [{ id: r.id, patch: { sort } as Partial<T> }]))
}
