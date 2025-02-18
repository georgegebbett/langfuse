import { Button } from "@/src/components/ui/button";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/src/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { api } from "@/src/utils/api";
import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { Input } from "@/src/components/ui/input";
import { DatePicker } from "@/src/components/date-picker";
import Header from "@/src/components/layouts/header";
import { AutoComplete } from "@/src/features/prompts/components/auto-complete";
import JsonView from "react18-json-view";

const formSchema = z.object({
  modelName: z.string().min(1),
  exactMatchPattern: z
    .string()
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Match pattern must be alphanumeric and may contain _.-",
    ), // risk of invalid regex injection that would break the db join,
  startDate: z.date().optional(),
  inputPrice: z
    .string()
    .refine((value) => value === "" || isFinite(parseFloat(value)), {
      message: "Price needs to be numeric",
    })
    .optional(),
  outputPrice: z
    .string()
    .refine((value) => value === "" || isFinite(parseFloat(value)), {
      message: "Price needs to be numeric",
    })
    .optional(),
  totalPrice: z
    .string()
    .refine((value) => value === "" || isFinite(parseFloat(value)), {
      message: "Price needs to be numeric",
    })
    .optional(),
  unit: z.enum(["TOKENS", "CHARACTERS"]),
  tokenizerId: z.enum(["openai", "claude", "None"]),
  tokenizerConfig: z.string().refine(
    (value) => {
      try {
        JSON.parse(value);
        return true;
      } catch (e) {
        return false;
      }
    },
    {
      message: "Tokenizer config needs to be valid JSON",
    },
  ),
});

export const NewModelForm = (props: {
  projectId: string;
  onFormSuccess?: () => void;
}) => {
  const [formError, setFormError] = useState<string | null>(null);
  const posthog = usePostHog();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      modelName: "",
      exactMatchPattern: "",
      startDate: undefined,
      inputPrice: "",
      outputPrice: "",
      totalPrice: "",
      unit: "TOKENS",
      tokenizerId: "None",
      tokenizerConfig: "{}",
    },
  });

  const utils = api.useUtils();
  const createModelMutation = api.models.create.useMutation({
    onSuccess: () => utils.models.invalidate(),
    onError: (error) => setFormError(error.message),
  });

  const modelNames = api.models.modelNames.useQuery({
    projectId: props.projectId,
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    posthog.capture("models:new_model_form_submit");
    createModelMutation
      .mutateAsync({
        projectId: props.projectId,
        modelName: values.modelName,
        exactMatchPattern: values.exactMatchPattern,
        inputPrice: !!values.inputPrice
          ? parseFloat(values.inputPrice)
          : undefined,
        outputPrice: !!values.outputPrice
          ? parseFloat(values.outputPrice)
          : undefined,
        totalPrice: !!values.totalPrice
          ? parseFloat(values.totalPrice)
          : undefined,
        unit: values.unit,
        tokenizerId:
          values.tokenizerId === "None" ? undefined : values.tokenizerId,
        tokenizerConfig:
          values.tokenizerConfig &&
          typeof JSON.parse(values.tokenizerConfig) === "object"
            ? (JSON.parse(values.tokenizerConfig) as Record<string, number>)
            : undefined,
      })
      .then(() => {
        props.onFormSuccess?.();
        form.reset();
      })
      .catch((error) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if ("message" in error && typeof error.message === "string") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          setFormError(error.message as string);
          return;
        } else {
          setFormError(JSON.stringify(error));
          console.error(error);
        }
      });
  }

  return (
    <Form {...form}>
      <form
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <Header level="h3" title="Name" />
        <FormField
          control={form.control}
          name="modelName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model Name</FormLabel>
              <FormControl>
                <AutoComplete
                  {...field}
                  options={
                    modelNames.data?.map((model) => ({
                      value: model,
                      label: model,
                    })) ?? []
                  }
                  placeholder=""
                  onValueChange={(option) => field.onChange(option.value)}
                  value={{ value: field.value, label: field.value }}
                  disabled={false}
                />
              </FormControl>
              <FormDescription>
                The name of the model. This will be used to reference the model
                in the API. You can track price changes of models by using the
                same name and match pattern.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Header level="h3" title="Scope" />
        <FormField
          control={form.control}
          name="exactMatchPattern"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Match pattern</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                `model` on generations that should match this model,
                case-insensitive.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start date</FormLabel>
              <FormControl>
                <DatePicker
                  date={field.value}
                  onChange={(date) => field.onChange(date)}
                  clearable
                />
              </FormControl>
              <FormDescription>
                If set, the model will only be used for generations after this
                date.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Header level="h3" title="Pricing" />
        <FormField
          control={form.control}
          name="unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unit</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a unit" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {["TOKENS", "CHARACTERS"].map((unit) => (
                    <SelectItem value={unit} key={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                The unit of measurement for the model.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-3 gap-2">
          <FormField
            control={form.control}
            name="inputPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Input price (USD)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" />
                </FormControl>
                <FormDescription>Cost per input unit.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="outputPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Output price (USD)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" />
                </FormControl>
                <FormDescription>Cost per output unit.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="totalPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total price (USD)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" />
                </FormControl>
                <FormDescription>
                  Cost per unit, if no separate input/output prices.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Header level="h3" title="Tokenization" />
        <FormField
          control={form.control}
          name="tokenizerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tokenizer</FormLabel>
              <Select
                onValueChange={(tokenizerId) => {
                  field.onChange(tokenizerId);
                  if (tokenizerId === "None") {
                    form.setValue("tokenizerConfig", "{}");
                  }
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a unit" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {["openai", "claude", "None"].map((unit) => (
                    <SelectItem value={unit} key={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Optionally, Langfuse can tokenize the input and output of a
                generation if no unit counts are ingested. This is useful for
                e.g. streamed OpenAI completions. For details on the supported
                tokenizers, see the docs.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.watch("tokenizerId") !== "None" && (
          <FormField
            control={form.control}
            name="tokenizerConfig"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tokenizer Config</FormLabel>
                <JsonView
                  src={JSON.parse(field.value) as unknown}
                  onEdit={(edit) => {
                    field.onChange(JSON.stringify(edit.src));
                  }}
                  editable
                  className="rounded-md border border-gray-200 p-2 text-sm"
                />
                <FormDescription>
                  The config for the tokenizer. Required for openai. See the
                  docs for details.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Button
          type="submit"
          loading={createModelMutation.isLoading}
          className="mt-3"
        >
          Save
        </Button>
      </form>
      {formError ? (
        <p className="text-red text-center">
          <span className="font-bold">Error:</span> {formError}
        </p>
      ) : null}
    </Form>
  );
};
