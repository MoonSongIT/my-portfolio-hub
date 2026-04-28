import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

/**
 * HTS import 세션 상태 (persist 미사용 — 탭/새로고침 시 초기화)
 *
 * previewRow: { entry, isDuplicate, isExcluded }
 */
export const useImportStore = create(
  immer((set) => ({
    parsedSheets: [],        // { sheetName, entries, totalRows }[]
    selectedSheet: null,     // string | null
    columnMapping: {},       // { [field]: columnName } — 자동 감지 결과, 사용자 수정 가능
    previewRows: [],         // { entry, isDuplicate, isExcluded }[]
    bulkPsychology: null,    // string | null — import 시 일괄 적용할 심리 카테고리

    setParsedSheets: (sheets) =>
      set((state) => {
        state.parsedSheets = sheets
        state.selectedSheet = sheets[0]?.sheetName ?? null
        state.previewRows = []
        state.columnMapping = {}
      }),

    setSelectedSheet: (sheetName) =>
      set((state) => {
        state.selectedSheet = sheetName
        state.previewRows = []
      }),

    setColumnMapping: (mapping) =>
      set((state) => {
        state.columnMapping = mapping
      }),

    setPreviewRows: (rows) =>
      set((state) => {
        state.previewRows = rows
      }),

    togglePreviewRow: (index) =>
      set((state) => {
        const row = state.previewRows[index]
        if (row) row.isExcluded = !row.isExcluded
      }),

    excludeAllDuplicates: () =>
      set((state) => {
        state.previewRows.forEach((row) => {
          if (row.isDuplicate) row.isExcluded = true
        })
      }),

    setBulkPsychology: (psychology) =>
      set((state) => {
        state.bulkPsychology = psychology
      }),

    reset: () =>
      set((state) => {
        state.parsedSheets = []
        state.selectedSheet = null
        state.columnMapping = {}
        state.previewRows = []
        state.bulkPsychology = null
      }),
  }))
)
