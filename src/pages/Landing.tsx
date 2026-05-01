import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";
import { PressableButton } from "@/components/ui/pressable-button";

const slides = [
  {
    image: "/landing/landing_01.png",
    title: "Every Song Holds a Moment",
    description:
      "Save the tracks that carry you back to the people, places, and feelings you never want to lose.",
  },
  {
    image: "/landing/landing_02.png",
    title: "The People Inside the Music",
    description:
      "Share the songs tied to the friends, family, loves, and seasons that shaped you.",
  },
  {
    image: "/landing/landing_03.png",
    title: "Find What Moves Others",
    description:
      "Discover memories through music, hear the tracks behind them, and find something new to carry with you.",
  },
];

interface LandingProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const Landing = ({ onGetStarted, onSignIn }: LandingProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedSlide = slides[selectedIndex] ?? slides[0];

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-foreground text-background">
      <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((slide, i) => (
            <div key={i} className="relative min-w-0 flex-[0_0_100%]">
              <img
                src={slide.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/55" />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 px-6 py-10">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            Songline
          </p>
          <h2 className="font-display text-4xl font-semibold leading-tight text-white">
            {selectedSlide.title}
          </h2>
          <p className="mx-auto mt-4 max-w-[310px] text-base leading-relaxed text-white/78">
            {selectedSlide.description}
          </p>

          <div className="mb-8 mt-10 flex gap-2">
          {slides.map((_, i) => (
            <PressableButton
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                selectedIndex === i
                  ? "w-6 bg-white"
                  : "w-2 bg-white/35"
              )}
            />
          ))}
          </div>

          <PressableButton
            onClick={onGetStarted}
            className="w-full rounded-lg bg-white py-4 text-sm font-semibold text-foreground transition-colors hover:bg-white/90"
          >
            Get Started
          </PressableButton>

          <p className="mt-5 text-sm text-white/75">
            Already have an account?{" "}
            <PressableButton
              onClick={onSignIn}
              className="font-semibold text-white hover:underline"
            >
              Sign In
            </PressableButton>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
