import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import TVBackgroundLogo from '../components/board/TVBackgroundLogo'
import TVBoardCanvas from '../components/board/TVBoardCanvas'
import TVClassNav from '../components/board/TVClassNav'
import TVDotsPodium from '../components/board/TVDotsPodium'
import TVDotsScroller from '../components/board/TVDotsScroller'
import TVPodium from '../components/board/TVPodium'
import TVScroller from '../components/board/TVScroller'
import {
  buildTvBoardPages,
  formatTVGenderLabel,
  formatTVWeightClassLabel,
  getClassLiftLeaders,
  getLeaderboardPages,
  sortMembersByTotal,
} from '../components/board/boardUtils'
import Loading from '../components/shared/Loading'
import { useBoardData } from '../hooks/useBoardData'
import { useDotsLeaderboardBySex } from '../hooks/useDotsLeaderboard'
import { mockDotsLeaderboardBySex } from '../mocks/dotsLeaderboardMock'

const REFRESH_INTERVAL_MS = 300000
const TRANSITION_MS = 600
const PODIUM_ONLY_PAUSE_MS = 7000
const HEADER_GAP_ABOVE_FIRST_PX = 100
const HEADER_MIN_LEFT_PX = 32
const HEADER_MIN_TOP_PX = 72
const HEADER_TOP_FONT = {
  split: 'text-[2.6rem]',
  full: 'text-[3.046875rem]',
}
const HEADER_WEIGHT_CLASS_FONT = {
  split: 'text-[5.85rem]',
  full: 'text-[7.3125rem]',
}

function getCanvasDesignScale(container) {
  if (!container?.offsetWidth) return 1
  return container.getBoundingClientRect().width / container.offsetWidth
}

function toDesignSpace(value, scale) {
  return value / (scale || 1)
}

export default function BoardTV() {
  const { members, loading, error, useMock } = useBoardData(REFRESH_INTERVAL_MS)
  const {
    bySex: dotsBySexLive,
    loading: dotsLoading,
    error: dotsError,
  } = useDotsLeaderboardBySex(REFRESH_INTERVAL_MS, { enabled: !useMock })

  const dotsBySex = useMock ? mockDotsLeaderboardBySex : dotsBySexLive

  const [classIndex, setClassIndex] = useState(0)
  const [displayedIndex, setDisplayedIndex] = useState(0)
  const [transitionPhase, setTransitionPhase] = useState('idle')

  const weightClassPages = useMemo(() => getLeaderboardPages(members), [members])
  const boardPages = useMemo(
    () => buildTvBoardPages(weightClassPages, dotsError ? {} : dotsBySex),
    [weightClassPages, dotsBySex, dotsError],
  )

  const pageKeys = useMemo(
    () => boardPages.map((page) => page.key).join('|'),
    [boardPages],
  )

  const displayedPage = boardPages[displayedIndex] ?? boardPages[0]
  const isDotsPage = displayedPage?.pageType === 'dots'

  const rankedMembers = useMemo(() => {
    if (isDotsPage) return []
    return sortMembersByTotal(displayedPage?.members ?? [])
  }, [displayedPage, isDotsPage])

  const rankedDotsEntries = useMemo(() => {
    if (!isDotsPage) return []
    return displayedPage?.entries ?? []
  }, [displayedPage, isDotsPage])

  const podiumMembers = isDotsPage ? [] : rankedMembers.slice(0, 3)
  const podiumDotsEntries = isDotsPage ? rankedDotsEntries.slice(0, 3) : []
  const remainingMembers = isDotsPage ? [] : rankedMembers.slice(3)
  const remainingDotsEntries = isDotsPage ? rankedDotsEntries.slice(3) : []
  const hasScroller = isDotsPage
    ? remainingDotsEntries.length > 0
    : remainingMembers.length > 0
  const liftLeaders = useMemo(
    () => (isDotsPage ? null : getClassLiftLeaders(rankedMembers)),
    [isDotsPage, rankedMembers],
  )

  const pageCount = boardPages.length
  const canNavigateClasses = pageCount > 1

  const goToNextWeightClass = useCallback(() => {
    if (!canNavigateClasses || transitionPhase !== 'idle') return
    setClassIndex((index) => (index + 1) % pageCount)
  }, [canNavigateClasses, pageCount, transitionPhase])

  const goToPreviousWeightClass = useCallback(() => {
    if (!canNavigateClasses || transitionPhase !== 'idle') return
    setClassIndex((index) => (index - 1 + pageCount) % pageCount)
  }, [canNavigateClasses, pageCount, transitionPhase])

  const advanceWeightClass = useCallback(() => {
    if (!canNavigateClasses) return
    setClassIndex((index) => (index + 1) % pageCount)
  }, [canNavigateClasses, pageCount])

  const handleScrollerComplete = useCallback(() => {
    if (transitionPhase !== 'idle') return
    advanceWeightClass()
  }, [transitionPhase, advanceWeightClass])

  useEffect(() => {
    setClassIndex(0)
    setDisplayedIndex(0)
    setTransitionPhase('idle')
  }, [pageKeys])

  useEffect(() => {
    if (classIndex === displayedIndex) return undefined

    setTransitionPhase('exiting')

    const swapTimer = setTimeout(() => {
      setDisplayedIndex(classIndex)
      setTransitionPhase('entering')
    }, TRANSITION_MS)

    return () => clearTimeout(swapTimer)
  }, [classIndex, displayedIndex])

  useEffect(() => {
    if (transitionPhase !== 'entering') return undefined

    const settleTimer = setTimeout(() => {
      setTransitionPhase('idle')
    }, TRANSITION_MS)

    return () => clearTimeout(settleTimer)
  }, [transitionPhase])

  useEffect(() => {
    if (transitionPhase !== 'idle') return undefined
    if (hasScroller) return undefined

    const timer = setTimeout(() => {
      advanceWeightClass()
    }, PODIUM_ONLY_PAUSE_MS)

    return () => clearTimeout(timer)
  }, [displayedPage?.key, hasScroller, transitionPhase, advanceWeightClass])

  const isExiting = transitionPhase === 'exiting'
  const isEntering = transitionPhase === 'entering'

  const labelContainerRef = useRef(null)
  const headerRef = useRef(null)
  const secondPlaceRef = useRef(null)
  const firstPlaceRef = useRef(null)
  const [labelPos, setLabelPos] = useState({ left: null, top: HEADER_MIN_TOP_PX, centered: false })

  const syncLabelAlignment = useCallback(() => {
    const container = labelContainerRef.current
    const firstPlace = firstPlaceRef.current
    const secondPlace = secondPlaceRef.current
    const header = headerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const headerHeight = header?.offsetHeight ?? 0
    const designScale = getCanvasDesignScale(container)

    if (!hasScroller) {
      if (!firstPlace) return

      const firstRect = firstPlace.getBoundingClientRect()
      const firstCenterX = toDesignSpace(
        firstRect.left - containerRect.left + firstRect.width / 2,
        designScale,
      )
      const firstTop = toDesignSpace(firstRect.top - containerRect.top, designScale)

      setLabelPos({
        left: firstCenterX,
        top: Math.max(
          HEADER_MIN_TOP_PX,
          firstTop - headerHeight - HEADER_GAP_ABOVE_FIRST_PX,
        ),
        centered: true,
      })
      return
    }

    const leftAnchor = secondPlace ?? firstPlace
    if (!leftAnchor) return

    const topAnchor = firstPlace ?? leftAnchor
    const topAnchorRect = topAnchor.getBoundingClientRect()
    const topAnchorTop = toDesignSpace(topAnchorRect.top - containerRect.top, designScale)

    setLabelPos({
      left: HEADER_MIN_LEFT_PX,
      top: Math.max(
        HEADER_MIN_TOP_PX,
        topAnchorTop - headerHeight - HEADER_GAP_ABOVE_FIRST_PX,
      ),
      centered: false,
    })
  }, [hasScroller])

  useLayoutEffect(() => {
    syncLabelAlignment()

    const container = labelContainerRef.current
    if (!container) return undefined

    const observer = new ResizeObserver(syncLabelAlignment)
    observer.observe(container)
    if (secondPlaceRef.current) observer.observe(secondPlaceRef.current)
    if (firstPlaceRef.current) observer.observe(firstPlaceRef.current)
    if (headerRef.current) observer.observe(headerRef.current)

    window.addEventListener('resize', syncLabelAlignment)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncLabelAlignment)
    }
  }, [
    syncLabelAlignment,
    displayedPage?.key,
    podiumMembers.length,
    podiumDotsEntries.length,
    hasScroller,
    transitionPhase,
  ])

  useEffect(() => {
    if (transitionPhase !== 'entering') return undefined
    const timer = setTimeout(syncLabelAlignment, TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [transitionPhase, syncLabelAlignment])

  const isInitialLoading =
    (loading && !members.length) ||
    (!useMock && dotsLoading && !weightClassPages.length && !Object.values(dotsBySex).flat().length)

  if (isInitialLoading) {
    return (
      <TVBoardCanvas className="flex items-center justify-center">
        <Loading label="Loading board..." className="text-catalyst-text/60" />
      </TVBoardCanvas>
    )
  }

  if (error) {
    return (
      <TVBoardCanvas className="flex items-center justify-center p-8 text-center text-red-400">
        Unable to load board.
      </TVBoardCanvas>
    )
  }

  if (!boardPages.length) {
    return (
      <TVBoardCanvas className="flex items-center justify-center p-8 text-center text-catalyst-text/60">
        No leaderboard data available.
      </TVBoardCanvas>
    )
  }

  const genderLabel = formatTVGenderLabel(displayedPage?.sex)
  const weightClassLabel = formatTVWeightClassLabel(displayedPage?.weightClass)
  const headingClass = [
    'transition-opacity duration-500',
    isExiting ? 'opacity-0' : 'opacity-100',
  ].join(' ')
  const headerCentered = !hasScroller
  const labelStyle = headerCentered
    ? { left: labelPos.left ?? '50%', top: labelPos.top }
    : labelPos.left != null
      ? { left: labelPos.left, top: labelPos.top }
      : { top: HEADER_MIN_TOP_PX }

  const classHeading = (
    <header
      ref={headerRef}
      className={[
        'absolute z-10 pt-2',
        headerCentered ? '-translate-x-1/2 text-center' : 'text-left',
        headingClass,
      ].join(' ')}
      style={labelStyle}
    >
      <p
        className={[
          'font-milker uppercase tracking-wide text-catalyst-text',
          hasScroller ? HEADER_TOP_FONT.split : HEADER_TOP_FONT.full,
        ].join(' ')}
      >
        {genderLabel}
      </p>
      <p
        className={[
          'font-milker uppercase leading-none text-catalyst-accent',
          hasScroller ? HEADER_WEIGHT_CLASS_FONT.split : HEADER_WEIGHT_CLASS_FONT.full,
        ].join(' ')}
      >
        {weightClassLabel}
      </p>
    </header>
  )

  const podium = isDotsPage ? (
    <TVDotsPodium
      entries={podiumDotsEntries}
      animate={isEntering}
      layout={hasScroller ? 'split' : 'centered'}
      secondPlaceRef={secondPlaceRef}
      firstPlaceRef={firstPlaceRef}
    />
  ) : (
    <TVPodium
      members={podiumMembers}
      animate={isEntering}
      layout={hasScroller ? 'split' : 'centered'}
      secondPlaceRef={secondPlaceRef}
      firstPlaceRef={firstPlaceRef}
      liftLeaders={liftLeaders}
    />
  )

  const scroller = isDotsPage ? (
    <TVDotsScroller
      key={displayedPage?.key}
      entries={remainingDotsEntries}
      onScrollComplete={handleScrollerComplete}
      layout="split"
    />
  ) : (
    <TVScroller
      key={displayedPage?.key}
      members={remainingMembers}
      onScrollComplete={handleScrollerComplete}
      layout="split"
      liftLeaders={liftLeaders}
    />
  )

  return (
    <TVBoardCanvas className="flex flex-col">
      <TVBackgroundLogo />

      <TVClassNav
        visible={canNavigateClasses}
        disabled={transitionPhase !== 'idle'}
        onPrevious={goToPreviousWeightClass}
        onNext={goToNextWeightClass}
      />

      <footer className="absolute bottom-[25px] left-[25px] z-20">
        <p className="font-pirulen text-6xl tracking-[0.15em] text-catalyst-text">CATALYST</p>
      </footer>

      {hasScroller ? (
        <div
          className={[
            'relative z-10 min-h-0 flex-1 transition-opacity duration-500',
            isExiting ? 'opacity-0' : 'opacity-100',
          ].join(' ')}
        >
          <div className="relative flex h-full min-h-0 gap-4 px-8 pb-8 pt-2">
            <aside ref={labelContainerRef} className="relative flex w-[50%] shrink-0 flex-col overflow-visible">
              {classHeading}

              <div className="flex min-h-0 w-full flex-1 items-center justify-start overflow-visible py-10 pl-0 pr-1">
                {podium}
              </div>
            </aside>
          </div>

          <div className="absolute inset-y-0 left-[50%] right-0 z-10 flex items-center px-6 pb-8 pt-2">
            <div className="w-full min-w-0">{scroller}</div>
          </div>
        </div>
      ) : (
        <div
          ref={labelContainerRef}
          className={[
            'relative z-10 flex-1 transition-opacity duration-500',
            isExiting ? 'opacity-0' : 'opacity-100',
          ].join(' ')}
        >
          {classHeading}

          <div className="absolute inset-0 flex items-center justify-center overflow-visible px-8 py-10">
            <div className="w-full">{podium}</div>
          </div>
        </div>
      )}
    </TVBoardCanvas>
  )
}
