package to.treasures.app;

import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(QRPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @CapacitorPlugin(name = "QRPlugin")
    public static class QRPlugin extends Plugin {

        /**
         * Save a base64-encoded PNG to the device's Pictures/Downloads.
         * Call: Capacitor.Plugins.QRPlugin.saveImage({ base64: '...', filename: 'foo.png' })
         */
        @PluginMethod
        public void saveImage(PluginCall call) {
            String base64 = call.getString("base64");
            String filename = call.getString("filename", "qr-code.png");

            if (base64 == null || base64.isEmpty()) {
                call.reject("base64 is required");
                return;
            }

            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                saveToMediaStore(getContext(), bytes, filename);
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to save image: " + e.getMessage());
            }
        }

        private void saveToMediaStore(Context ctx, byte[] bytes, String filename) throws IOException {
            OutputStream out;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(MediaStore.Images.Media.RELATIVE_PATH,
                        Environment.DIRECTORY_PICTURES + "/Treasures");
                Uri uri = ctx.getContentResolver()
                        .insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IOException("MediaStore insert returned null");
                out = ctx.getContentResolver().openOutputStream(uri);
            } else {
                File dir = new File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                        "Treasures");
                if (!dir.exists()) dir.mkdirs();
                File file = new File(dir, filename);
                out = new FileOutputStream(file);
            }
            if (out == null) throw new IOException("Could not open output stream");
            out.write(bytes);
            out.close();
        }

        /**
         * Print a base64-encoded PNG using Android's PrintManager.
         * Call: Capacitor.Plugins.QRPlugin.printImage({ base64: '...' })
         */
        @PluginMethod
        public void printImage(PluginCall call) {
            String base64 = call.getString("base64");
            if (base64 == null || base64.isEmpty()) {
                call.reject("base64 is required");
                return;
            }

            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap == null) {
                call.reject("Could not decode image");
                return;
            }

            getActivity().runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getContext()
                        .getSystemService(Context.PRINT_SERVICE);
                pm.print("Treasures QR Code",
                        new BitmapPrintAdapter(getContext(), bitmap),
                        new PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.NA_LETTER)
                                .build());
            });
            call.resolve();
        }

        /** Minimal PrintDocumentAdapter that renders one bitmap page. */
        private static class BitmapPrintAdapter extends PrintDocumentAdapter {
            private final Context ctx;
            private final Bitmap bitmap;

            BitmapPrintAdapter(Context ctx, Bitmap bitmap) {
                this.ctx = ctx;
                this.bitmap = bitmap;
            }

            @Override
            public void onLayout(PrintAttributes oldAttrs, PrintAttributes newAttrs,
                                  CancellationSignal cancel, LayoutResultCallback cb,
                                  Bundle extras) {
                if (cancel.isCanceled()) { cb.onLayoutCancelled(); return; }
                PrintDocumentInfo info = new PrintDocumentInfo.Builder("qr-code.pdf")
                        .setContentType(PrintDocumentInfo.CONTENT_TYPE_PHOTO)
                        .setPageCount(1)
                        .build();
                cb.onLayoutFinished(info, !newAttrs.equals(oldAttrs));
            }

            @Override
            public void onWrite(PageRange[] pages, ParcelFileDescriptor dest,
                                CancellationSignal cancel, WriteResultCallback cb) {
                try (OutputStream out = new FileOutputStream(dest.getFileDescriptor())) {
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
                    cb.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
                } catch (Exception e) {
                    cb.onWriteFailed(e.getMessage());
                }
            }
        }
    }
}
